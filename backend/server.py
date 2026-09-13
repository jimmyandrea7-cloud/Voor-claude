"""RefCheck backend — vintage watch identification (multi-brand ready, Omega at launch)."""
import os
import json
import csv
import uuid
import base64
import logging
from pathlib import Path
from urllib.parse import urlencode
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import requests
import stripe
import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Header, Query, Depends
from fastapi.responses import Response as FastResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("refcheck")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
REPORT_LOOKUP_KEY = os.environ.get("REPORT_UNLOCK_LOOKUP_KEY", "report_unlock_single")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or ""
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# ----- AI vision (Anthropic Claude) -----
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# ----- Google OAuth -----
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none")

# ----- Object storage (local disk) -----
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR") or (ROOT_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
APP_NAME = "refcheck"
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "10")) * 1024 * 1024

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}


def put_object(path: str, data: bytes, content_type: str) -> dict:
    full = (UPLOAD_DIR / path).resolve()
    if UPLOAD_DIR.resolve() not in full.parents:
        raise HTTPException(status_code=400, detail="Invalid storage path")
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    return {"path": path, "size": len(data)}


def get_object(path: str):
    full = (UPLOAD_DIR / path).resolve()
    if UPLOAD_DIR.resolve() not in full.parents or not full.exists():
        raise HTTPException(status_code=404, detail="File not found")
    ext = full.suffix.lstrip(".").lower()
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    return full.read_bytes(), content_type


app = FastAPI(title="RefCheck API")
api = APIRouter(prefix="/api")


# ============================ Models ============================
def now_iso():
    return datetime.now(timezone.utc).isoformat()


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool = False
    created_at: str = Field(default_factory=now_iso)


class Brand(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    notes: Optional[str] = ""
    active: bool = True
    coming_soon_label: Optional[str] = None
    tagline: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ReferenceEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand_id: str
    model_family: str
    reference_numbers: List[str] = []
    serial_range_start: Optional[str] = None
    serial_range_end: Optional[str] = None
    production_period: Optional[str] = None
    case_material: Optional[str] = None
    movement_caliber: Optional[str] = None
    dial_variants: Optional[str] = None
    notable_history: Optional[str] = None
    source_notes: Optional[str] = None
    image_examples: List[str] = []
    created_at: str = Field(default_factory=now_iso)


class ReferenceEntryInput(BaseModel):
    brand_id: str
    model_family: str
    reference_numbers: List[str] = []
    serial_range_start: Optional[str] = None
    serial_range_end: Optional[str] = None
    production_period: Optional[str] = None
    case_material: Optional[str] = None
    movement_caliber: Optional[str] = None
    dial_variants: Optional[str] = None
    notable_history: Optional[str] = None
    source_notes: Optional[str] = None
    image_examples: List[str] = []


class ScanPhoto(BaseModel):
    slot: str
    file_id: str
    storage_path: str


class ScanDescription(BaseModel):
    notes: Optional[str] = ""  # freeform: serial number, inscriptions, family papers, anything else known


class ScanCreate(BaseModel):
    brand_id: str


class Scan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    brand_id: str
    photos: List[ScanPhoto] = []
    description: ScanDescription = Field(default_factory=ScanDescription)
    result: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    status: str = "draft"  # draft | analyzed
    paid: bool = False
    created_at: str = Field(default_factory=now_iso)


# ============================ Auth ============================
async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> User:
    token = None
    if "session_token" in request.cookies:
        token = request.cookies.get("session_token")
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api.get("/auth/google/login")
async def google_login():
    if not (GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI):
        raise HTTPException(status_code=503, detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.")
    state = uuid.uuid4().hex
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    resp = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")
    resp.set_cookie("oauth_state", state, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/", max_age=600)
    return resp


@api.get("/auth/google/callback")
async def google_callback(request: Request, code: Optional[str] = Query(None), state: Optional[str] = Query(None), error: Optional[str] = Query(None)):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=oauth_failed")
    saved_state = request.cookies.get("oauth_state")
    if not saved_state or saved_state != state:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=state_mismatch")

    token_resp = requests.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
    }, timeout=30)
    if token_resp.status_code != 200:
        logger.warning(f"Google token exchange failed: {token_resp.text}")
        return RedirectResponse(f"{FRONTEND_URL}/login?error=token_exchange_failed")
    access_token = token_resp.json()["access_token"]

    userinfo_resp = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}, timeout=30,
    )
    if userinfo_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=userinfo_failed")
    info = userinfo_resp.json()
    email = (info.get("email") or "").lower()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=no_email")
    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        is_admin = existing.get("is_admin", False) or email in ADMIN_EMAILS
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture, "is_admin": is_admin}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        is_admin = email in ADMIN_EMAILS
        await db.users.insert_one(User(user_id=user_id, email=email, name=name, picture=picture, is_admin=is_admin).model_dump())

    session_token = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token, "expires_at": expires_at.isoformat(), "created_at": now_iso()})

    resp = RedirectResponse(f"{FRONTEND_URL}/dashboard")
    resp.set_cookie("session_token", session_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/", max_age=7 * 24 * 3600)
    resp.delete_cookie("oauth_state", path="/")
    return resp


@api.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============================ Settings ============================
DEFAULT_SETTINGS = {
    "key": "app",
    "report_price_display": "€ 4,99",
    "report_price_amount": 4.99,
    "report_currency": "eur",
    "subscription_enabled": False,
    "subscription_price_display": "€ 4,99/mo",
    "subscription_note": "Unlimited report unlocks (coming soon)",
}


async def get_settings():
    doc = await db.settings.find_one({"key": "app"}, {"_id": 0})
    if not doc:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        return dict(DEFAULT_SETTINGS)
    return doc


@api.get("/settings")
async def read_settings():
    return await get_settings()


class SettingsUpdate(BaseModel):
    report_price_display: Optional[str] = None
    report_price_amount: Optional[float] = None
    subscription_enabled: Optional[bool] = None
    subscription_price_display: Optional[str] = None
    subscription_note: Optional[str] = None


@api.put("/settings")
async def update_settings(payload: SettingsUpdate, admin: User = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.settings.update_one({"key": "app"}, {"$set": updates}, upsert=True)
    return await get_settings()


# ============================ Brands ============================
@api.get("/brands", response_model=List[Brand])
async def list_brands():
    docs = await db.brands.find({}, {"_id": 0}).to_list(100)
    docs.sort(key=lambda b: (not b.get("active", False), b.get("name", "")))
    return [Brand(**d) for d in docs]


@api.get("/brands/{brand_id}", response_model=Brand)
async def get_brand(brand_id: str):
    doc = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")
    return Brand(**doc)


class BrandInput(BaseModel):
    name: str
    notes: Optional[str] = ""
    active: bool = True
    coming_soon_label: Optional[str] = None
    tagline: Optional[str] = ""


@api.post("/brands", response_model=Brand)
async def create_brand(payload: BrandInput, admin: User = Depends(require_admin)):
    brand = Brand(**payload.model_dump())
    await db.brands.insert_one(brand.model_dump())
    return brand


@api.put("/brands/{brand_id}", response_model=Brand)
async def update_brand(brand_id: str, payload: BrandInput, admin: User = Depends(require_admin)):
    doc = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.brands.update_one({"id": brand_id}, {"$set": payload.model_dump()})
    doc = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    return Brand(**doc)


# ============================ Reference Entries ============================
@api.get("/reference-entries", response_model=List[ReferenceEntry])
async def list_reference_entries(brand_id: Optional[str] = Query(None), search: Optional[str] = Query(None)):
    q = {}
    if brand_id:
        q["brand_id"] = brand_id
    docs = await db.reference_entries.find(q, {"_id": 0}).to_list(1000)
    if search:
        s = search.lower()
        docs = [d for d in docs if s in json.dumps(d).lower()]
    docs.sort(key=lambda d: d.get("model_family", ""))
    return [ReferenceEntry(**d) for d in docs]


@api.post("/reference-entries", response_model=ReferenceEntry)
async def create_reference_entry(payload: ReferenceEntryInput, admin: User = Depends(require_admin)):
    entry = ReferenceEntry(**payload.model_dump())
    await db.reference_entries.insert_one(entry.model_dump())
    return entry


@api.put("/reference-entries/{entry_id}", response_model=ReferenceEntry)
async def update_reference_entry(entry_id: str, payload: ReferenceEntryInput, admin: User = Depends(require_admin)):
    doc = await db.reference_entries.find_one({"id": entry_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.reference_entries.update_one({"id": entry_id}, {"$set": payload.model_dump()})
    doc = await db.reference_entries.find_one({"id": entry_id}, {"_id": 0})
    return ReferenceEntry(**doc)


@api.delete("/reference-entries/{entry_id}")
async def delete_reference_entry(entry_id: str, admin: User = Depends(require_admin)):
    res = await db.reference_entries.delete_one({"id": entry_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


# ============================ File uploads ============================
@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg")
    content_type = MIME_TYPES.get(ext, file.content_type or "image/jpeg")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user.user_id}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024*1024)}MB)")
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": file_id, "storage_path": result["path"], "original_filename": file.filename,
        "content_type": content_type, "size": result.get("size"), "user_id": user.user_id,
        "is_deleted": False, "created_at": now_iso(),
    })
    return {"file_id": file_id, "storage_path": result["path"], "content_type": content_type}


@api.get("/files/{file_id}")
async def download_file(file_id: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(record["storage_path"])
    return FastResponse(content=data, media_type=record.get("content_type", content_type))


# ============================ Scans ============================
@api.post("/scans", response_model=Scan)
async def create_scan(payload: ScanCreate, user: User = Depends(get_current_user)):
    brand = await db.brands.find_one({"id": payload.brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not brand.get("active"):
        raise HTTPException(status_code=400, detail="Brand not yet supported")
    scan = Scan(user_id=user.user_id, brand_id=payload.brand_id)
    await db.scans.insert_one(scan.model_dump())
    return scan


@api.get("/scans", response_model=List[Scan])
async def list_scans(user: User = Depends(get_current_user)):
    docs = await db.scans.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [Scan(**d) for d in docs]


async def _get_owned_scan(scan_id: str, user: User) -> dict:
    doc = await db.scans.find_one({"id": scan_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    return doc


@api.get("/scans/{scan_id}")
async def get_scan(scan_id: str, user: User = Depends(get_current_user)):
    doc = await _get_owned_scan(scan_id, user)
    scan = Scan(**doc)
    if not scan.paid and scan.result:
        # gate paid-only fields for free tier
        scan = scan.model_copy()
        scan.result = free_result_view(scan.result)
    return scan


class ScanPhotosUpdate(BaseModel):
    photos: List[ScanPhoto]


@api.put("/scans/{scan_id}/photos", response_model=Scan)
async def update_scan_photos(scan_id: str, payload: ScanPhotosUpdate, user: User = Depends(get_current_user)):
    await _get_owned_scan(scan_id, user)
    photos = [p.model_dump() for p in payload.photos]
    await db.scans.update_one({"id": scan_id}, {"$set": {"photos": photos}})
    doc = await _get_owned_scan(scan_id, user)
    return Scan(**doc)


@api.put("/scans/{scan_id}/description", response_model=Scan)
async def update_scan_description(scan_id: str, payload: ScanDescription, user: User = Depends(get_current_user)):
    await _get_owned_scan(scan_id, user)
    await db.scans.update_one({"id": scan_id}, {"$set": {"description": payload.model_dump()}})
    doc = await _get_owned_scan(scan_id, user)
    return Scan(**doc)


def free_result_view(result: Dict[str, Any]) -> Dict[str, Any]:
    """Preliminary (free) view: maker, family, period, confidence — no case reference,
    calibre, serial range or the matched-attribute evidence table."""
    return {
        "maker": result.get("maker"),
        "family": result.get("family"),
        "estimated_period": result.get("estimated_period"),
        "confidence_percentage": result.get("confidence_percentage"),
        "preliminary_summary": result.get("preliminary_summary"),
        "confidence_note": result.get("confidence_note"),
        "headline_highlights": result.get("headline_highlights", []),
        "used_database_match": result.get("used_database_match", False),
        "low_confidence": result.get("confidence_percentage", 0) < 40,
        "additional_photo_suggestion": result.get("additional_photo_suggestion"),
        "locked": True,
    }


# ============================ AI Analysis ============================
# "match" values, most to least certain: Exact | In range | Strong | Consistent | Unresolved | Contradicted
ANALYSIS_SCHEMA_HINT = """Return ONLY valid minified JSON (no markdown fences) with EXACTLY these keys:
{
 "maker": string,                     // e.g. "Omega"
 "family": string,                    // model family/line, e.g. "Seamaster"
 "case_reference": string,            // e.g. "14700 SC-61", "" if unresolved
 "calibre": string,                   // e.g. "552, automatic", "" if unresolved
 "serial_range": string,              // e.g. "24.8M – 25.1M", "" if unresolved
 "estimated_period": string,          // e.g. "circa 1960–1965"
 "confidence_percentage": number,     // 0-100 integer, overall
 "preliminary_summary": string,       // 1-2 sentences for the free result, e.g. "Omega Seamaster, early 1960s."
 "confidence_note": string,           // short caption, e.g. "Dial and case matched. Serial confirmation outstanding."
 "matched_attributes": [              // one row per physical attribute actually checked
   {
     "attribute": string,             // e.g. "Case reference", "Calibre", "Dial variant", "Crown", "Bracelet"
     "finding": string,               // what was found, e.g. "Linen, applied indices"
     "source": string,                // where the evidence came from, e.g. "Archival plates, 3 of 4"
     "match": string                  // one of: Exact | In range | Strong | Consistent | Unresolved | Contradicted
   }
 ],
 "reading": string,                   // 2-4 sentences: how the matched attributes together support the identification
 "unresolved_note": string,           // 1-2 sentences on what's unresolved and why it doesn't block the identification; "" if nothing is unresolved
 "used_database_match": boolean,      // true if a DB serial range / reference matched
 "headline_highlights": [string],     // 2-3 short visual cues that drove the guess
 "additional_photo_suggestion": string  // if confidence < 40, what photo/detail helps most, else ""
}"""


def build_reference_context(entries: List[dict]) -> str:
    if not entries:
        return "No internal reference entries available for this brand."
    lines = []
    for e in entries:
        lines.append(
            f"- Model family: {e.get('model_family')} | Refs: {', '.join(e.get('reference_numbers') or []) or 'n/a'} | "
            f"Serial range: {e.get('serial_range_start') or '?'}–{e.get('serial_range_end') or '?'} | "
            f"Period: {e.get('production_period') or '?'} | Case: {e.get('case_material') or '?'} | "
            f"Caliber: {e.get('movement_caliber') or '?'} | Dials: {e.get('dial_variants') or '?'} | "
            f"History: {e.get('notable_history') or ''}"
        )
    return "\n".join(lines)


MAX_ANALYSES_PER_DAY = int(os.environ.get("MAX_ANALYSES_PER_DAY_PER_USER", "10"))


@api.post("/scans/{scan_id}/analyze")
async def analyze_scan(scan_id: str, user: User = Depends(get_current_user)):
    if not anthropic_client:
        raise HTTPException(status_code=503, detail="AI analysis is not configured. Set ANTHROPIC_API_KEY.")

    doc = await _get_owned_scan(scan_id, user)
    scan = Scan(**doc)
    if not scan.photos:
        raise HTTPException(status_code=400, detail="Upload at least one photo before analysis")

    if MAX_ANALYSES_PER_DAY > 0:
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_count = await db.scans.count_documents({"user_id": user.user_id, "analyzed_at": {"$gte": since}})
        if recent_count >= MAX_ANALYSES_PER_DAY:
            raise HTTPException(status_code=429, detail=f"Daily analysis limit reached ({MAX_ANALYSES_PER_DAY}/day). Try again tomorrow.")

    brand = await db.brands.find_one({"id": scan.brand_id}, {"_id": 0})
    brand_name = brand.get("name") if brand else "Unknown"
    ref_docs = await db.reference_entries.find({"brand_id": scan.brand_id}, {"_id": 0}).to_list(1000)
    ref_context = build_reference_context(ref_docs)

    # Build image attachments from storage
    images = []
    photo_labels = []
    for p in scan.photos:
        rec = await db.files.find_one({"id": p.file_id, "is_deleted": False}, {"_id": 0})
        if not rec:
            continue
        try:
            data, content_type = get_object(rec["storage_path"])
            images.append({"media_type": rec.get("content_type") or content_type, "b64": base64.b64encode(data).decode()})
            photo_labels.append(p.slot)
        except Exception as ex:
            logger.warning(f"skip image {p.file_id}: {ex}")

    d = scan.description
    user_text = f"""You are identifying a vintage {brand_name} watch from user photos and details.

PHOTOS PROVIDED (in order): {', '.join(photo_labels) or 'none'}

ANYTHING THE USER ALREADY KNOWS: {d.notes or 'n/a'}

INTERNAL {brand_name.upper()} REFERENCE DATABASE (cross-reference any extracted serial/reference numbers against these):
{ref_context}

INSTRUCTIONS:
1. Analyze the photos for {brand_name} design language, typography, case shape, hands, dial, crown, bracelet, era-typical features.
2. Extract any serial/reference numbers from the photos or the user's text.
3. Cross-reference against the reference database above. If a serial range or reference number matches, weight it heavily and set used_database_match=true. If nothing matches, rely on visual reasoning and set used_database_match=false, and say so.
4. Build matched_attributes from what you can actually check against the photos and the reference data — do not invent rows for attributes you have no evidence for. Each row's "match" must honestly reflect how certain that one attribute is; a physically present but undateable/inconsistent detail (e.g. a clearly later replacement part) should be "Unresolved" or "Contradicted", not smoothed over.
5. Never claim certified authentication — matches are evidence, not certificates.
6. If confidence < 40, set additional_photo_suggestion to the single most useful extra photo/detail.

{ANALYSIS_SCHEMA_HINT}"""

    content = []
    for img in images:
        content.append({"type": "image", "source": {"type": "base64", "media_type": img["media_type"], "data": img["b64"]}})
    content.append({"type": "text", "text": user_text})

    try:
        response = await anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2000,
            system="You are an expert vintage watch appraiser and horologist specializing in identifying watches from photographs. You are precise, cautious, and never claim certified authentication. You always answer with strictly valid JSON.",
            messages=[{"role": "user", "content": content}],
        )
        raw = "".join(block.text for block in response.content if block.type == "text")
    except Exception as ex:
        logger.exception("AI analysis failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {ex}")

    result = parse_json_result(raw)
    conf = float(result.get("confidence_percentage") or 0)
    await db.scans.update_one({"id": scan_id}, {"$set": {"result": result, "confidence_score": conf, "status": "analyzed", "analyzed_at": now_iso()}})

    updated = await _get_owned_scan(scan_id, user)
    out = Scan(**updated)
    if not out.paid:
        out = out.model_copy()
        out.result = free_result_view(result)
    return out


def parse_json_result(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    try:
        data = json.loads(text)
    except Exception:
        data = {}
    data.setdefault("maker", "Undetermined")
    data.setdefault("family", "")
    data.setdefault("case_reference", "")
    data.setdefault("calibre", "")
    data.setdefault("serial_range", "")
    data.setdefault("estimated_period", "Unknown")
    data.setdefault("confidence_percentage", 0)
    data.setdefault("preliminary_summary", "")
    data.setdefault("confidence_note", "")
    data.setdefault("matched_attributes", [])
    data.setdefault("reading", "")
    data.setdefault("unresolved_note", "")
    data.setdefault("used_database_match", False)
    data.setdefault("headline_highlights", [])
    data.setdefault("additional_photo_suggestion", "")
    try:
        data["confidence_percentage"] = int(round(float(data["confidence_percentage"])))
    except Exception:
        data["confidence_percentage"] = 0

    matches = data.get("matched_attributes") or []
    data["attribute_summary"] = {
        "matched": sum(1 for m in matches if (m.get("match") or "").lower() not in ("unresolved", "contradicted")),
        "unresolved": sum(1 for m in matches if (m.get("match") or "").lower() == "unresolved"),
        "contradicted": sum(1 for m in matches if (m.get("match") or "").lower() == "contradicted"),
    }
    return data


# ============================ Payments (Stripe Flow A) ============================
class CheckoutRequest(BaseModel):
    scan_id: str
    origin_url: str


@api.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest, user: User = Depends(get_current_user)):
    await _get_owned_scan(req.scan_id, user)
    prices = stripe.Price.list(lookup_keys=[REPORT_LOOKUP_KEY], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=500, detail=f"Price not found: {REPORT_LOOKUP_KEY}")
    price = prices[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata={"user_id": user.user_id, "scan_id": req.scan_id, "lookup_key": REPORT_LOOKUP_KEY},
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")
        else:
            raise
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user.user_id, "scan_id": req.scan_id,
        "lookup_key": REPORT_LOOKUP_KEY, "amount": (price.unit_amount or 0), "currency": price.currency,
        "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def _mark_paid(session_id: str, record: dict):
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso()}},
    )
    if record.get("scan_id"):
        await db.scans.update_one({"id": record["scan_id"]}, {"$set": {"paid": True}})


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, record)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"], "scan_id": record.get("scan_id")}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        record = await db.payment_transactions.find_one({"session_id": obj["id"]}, {"_id": 0})
        if record:
            await _mark_paid(obj["id"], record)
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
    return {"status": "ok"}


# ============================ Seed ============================
async def seed_data():
    if await db.brands.count_documents({}) == 0:
        omega = Brand(name="Omega", tagline="Speedmaster, Seamaster, Constellation, De Ville", active=True, notes="Fully supported at launch.")
        await db.brands.insert_one(omega.model_dump())
        for name, label, tag in [
            ("Rolex", "Q3 2026", "Submariner, Datejust, Daytona"),
            ("Patek Philippe", "Q4 2026", "Calatrava, Nautilus"),
            ("Audemars Piguet", "Q4 2026", "Royal Oak"),
        ]:
            await db.brands.insert_one(Brand(name=name, tagline=tag, active=False, coming_soon_label=label).model_dump())

    omega_doc = await db.brands.find_one({"name": "Omega"}, {"_id": 0})
    if omega_doc:
        oid = omega_doc["id"]
        seeds = [
            dict(model_family="Speedmaster Professional 'Moonwatch'", reference_numbers=["105.012", "145.012", "ST 145.022"],
                 serial_range_start="24000000", serial_range_end="30000000", production_period="1963-1970",
                 case_material="Stainless steel", movement_caliber="Cal. 321 / 861",
                 dial_variants="Stepped dial, applied logo, tritium indices",
                 notable_history="First watch worn on the Moon (Apollo 11, 1969). NASA-qualified for all manned space missions.",
                 source_notes="Seed data — verify against Omega extract."),
            dict(model_family="Seamaster 300", reference_numbers=["CK2913", "165.024", "166.024"],
                 serial_range_start="14000000", serial_range_end="26000000", production_period="1957-1969",
                 case_material="Stainless steel", movement_caliber="Cal. 501 / 552",
                 dial_variants="Broad arrow hands, Naiad crown, diver bezel",
                 notable_history="Professional dive watch of the late 1950s-60s; military-issued variants exist.",
                 source_notes="Seed data — incomplete."),
            dict(model_family="Constellation 'Pie-Pan'", reference_numbers=["167.005", "168.005", "14381"],
                 serial_range_start="15000000", serial_range_end="24000000", production_period="1952-1970",
                 case_material="Steel / gold-capped / solid gold", movement_caliber="Cal. 551 / 561 chronometer",
                 dial_variants="12-sided 'pie-pan' dial, dodecagonal, observatory medallion caseback",
                 notable_history="Omega's flagship certified chronometer line; the pie-pan dial is highly collectible.",
                 source_notes="Seed data — approximate."),
            dict(model_family="De Ville (early, Seamaster-derived)", reference_numbers=["135.007", "111.001"],
                 serial_range_start="24000000", serial_range_end="32000000", production_period="1960-1974",
                 case_material="Steel / gold", movement_caliber="Cal. 550 / 601",
                 dial_variants="Slim dress dial, minimal markers",
                 notable_history="Started as a dressier Seamaster line before becoming a standalone collection in 1967.",
                 source_notes="Seed data — incomplete."),
            dict(model_family="Geneve", reference_numbers=["135.041", "166.070"],
                 serial_range_start="26000000", serial_range_end="40000000", production_period="1953-1979",
                 case_material="Steel / gold-plated", movement_caliber="Cal. 601 / 1012",
                 dial_variants="Entry-level everyday dials, varied",
                 notable_history="Omega's more affordable everyday line; huge production variety.",
                 source_notes="Seed data — broad."),
            dict(model_family="30T2 Sub-Seconds Dress (pre-Seamaster)", reference_numbers=["CK2364", "CK2384"],
                 serial_range_start="9500000", serial_range_end="12500000", production_period="1939-1949",
                 case_material="Steel / gold-plated / solid gold", movement_caliber="Cal. 30T2 / 30T2SC",
                 dial_variants="Small subsidiary seconds at 6, applied Arabic or dagger indices; two-tone 'sector' dials on early examples",
                 notable_history="The 30mm 30T2 movement family defined Omega's precise manual-wind dress watches of the 1940s and underpinned many of the brand's chronometer and military pieces of the era.",
                 source_notes="seed data, verify against Omega extract"),
            dict(model_family="Chronometre 30T2 RG (chronometer-grade)", reference_numbers=["CK2364", "OT2364"],
                 serial_range_start="9000000", serial_range_end="12000000", production_period="1940-1950",
                 case_material="Solid gold / steel", movement_caliber="Cal. 30T2 RG (Réglage de précision)",
                 dial_variants="Sub-seconds at 6, 'Chronomètre' script on dial, precision-regulated",
                 notable_history="Chronometer-grade regulation of the 30T2; examples were entered in the Kew-Teddington and Geneva observatory precision trials, earning Omega a strong pre-1950 accuracy reputation.",
                 source_notes="seed data, verify against Omega extract"),
            dict(model_family="WWW 'Dirty Dozen' (CK2444)", reference_numbers=["CK2444"],
                 serial_range_start="10000000", serial_range_end="11000000", production_period="1944-1945",
                 case_material="Stainless steel", movement_caliber="Cal. 30T2 SC PC",
                 dial_variants="Black dial, white Arabic numerals, railroad minute track, subsidiary seconds at 6; caseback engraved W.W.W. and broad-arrow military marks",
                 notable_history="Omega's contribution to the British Ministry of Defence 'Watch, Wrist, Waterproof' specification — one of the twelve makers collectors call the 'Dirty Dozen', of which Omega supplied the largest share.",
                 source_notes="seed data, verify against Omega extract"),
            dict(model_family="CK2292 R.A.F. Pilot (WWII)", reference_numbers=["CK2292"],
                 serial_range_start="9500000", serial_range_end="10500000", production_period="1940-1945",
                 case_material="Chromed brass / stainless steel", movement_caliber="Cal. 30T2 SC",
                 dial_variants="Large legible Arabic numerals, white or black dial, subsidiary seconds at 6; military-issued examples carry broad-arrow and issue markings",
                 notable_history="Large, highly legible Omega pilot watches issued to British and Commonwealth air forces in the early 1940s; genuine service-issued pieces are identified by caseback issue engravings.",
                 source_notes="seed data, verify against Omega extract"),
            dict(model_family="Medicus Doctor's Watch (pre-war)", reference_numbers=["CK2166", "CK2179"],
                 serial_range_start="8500000", serial_range_end="10000000", production_period="1939-1944",
                 case_material="Stainless steel", movement_caliber="Cal. 30T2 SC",
                 dial_variants="Prominent central or subsidiary seconds for pulse-taking, clean high-contrast layout",
                 notable_history="Marketed to physicians for taking a patient's pulse — an early example of Omega tailoring a manual-wind watch to a specific profession.",
                 source_notes="seed data, verify against Omega extract"),
        ]
        for s in seeds:
            exists = await db.reference_entries.find_one({"brand_id": oid, "model_family": s["model_family"]}, {"_id": 1})
            if not exists:
                await db.reference_entries.insert_one(ReferenceEntry(brand_id=oid, **s).model_dump())

    await get_settings()


# ============================ Community CSV import (one-time) ============================
CSV_IMPORT_KEY = "omega_csv_import_v1"
CSV_PATH = ROOT_DIR / "data" / "omega_database.csv"
CSV_SOURCE_NOTE = (
    "Community-sourced: OmegaForums.net 'The ULTIMATE vintage OMEGA database' thread "
    "(compiled by a forum member, building on Desmond's original Constellation database). "
    "Not official Omega data — verify important matches with an Omega Extract from the Archives."
)


def _combine(values):
    """Distinct, order-preserving, non-empty values joined for display."""
    seen, out = set(), []
    for v in values:
        v = (v or "").strip()
        if v and v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return " · ".join(out)


async def import_community_csv():
    """One-time import of the community vintage Omega CSV. Never touches hand-curated entries."""
    if await db.seed_meta.find_one({"key": CSV_IMPORT_KEY}):
        return
    if not CSV_PATH.exists():
        logger.warning(f"Community CSV not found at {CSV_PATH}; skipping import.")
        return

    omega_doc = await db.brands.find_one({"name": "Omega"}, {"_id": 0})
    if not omega_doc:
        return
    oid = omega_doc["id"]

    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        all_rows = [r for r in reader if any((c or "").strip() for c in r)]

    # Locate the header row (the banner title occupies the first line).
    header_idx = next((i for i, r in enumerate(all_rows) if r and r[0].strip() == "Case reference"), None)
    if header_idx is None:
        logger.warning("Community CSV header row not found; skipping import.")
        return
    data_rows = all_rows[header_idx + 1:]

    # Column indices per the known schema.
    C_CASE, C_LINE, C_DESC, C_CAL, C_YEAR, C_CASETYPE, C_MATERIAL, C_DIAL, C_CATREF = 0, 1, 3, 5, 6, 7, 8, 9, 11

    groups = {}
    order = []
    for r in data_rows:
        if len(r) <= C_LINE:
            continue
        case_ref = (r[C_CASE] or "").strip()
        product_line = (r[C_LINE] or "").strip()
        if not product_line and not case_ref:
            continue
        key = (product_line, case_ref)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(r)

    def cell(row, idx):
        return row[idx].strip() if len(row) > idx and row[idx] else ""

    docs = []
    for key in order:
        product_line, case_ref = key
        rows = groups[key]
        cat_refs = _combine(cell(r, C_CATREF) for r in rows)
        reference_numbers = []
        if case_ref:
            reference_numbers.append(case_ref)
        for cr in [c for c in (cat_refs.split(" · ") if cat_refs else []) if c]:
            reference_numbers.append(cr)

        entry = ReferenceEntry(
            brand_id=oid,
            model_family=product_line or "Omega (unspecified line)",
            reference_numbers=reference_numbers,
            production_period=_combine(cell(r, C_YEAR) for r in rows),
            case_material=_combine(cell(r, C_MATERIAL) for r in rows),
            movement_caliber=_combine(cell(r, C_CAL) for r in rows),
            dial_variants=_combine(cell(r, C_DIAL) for r in rows),
            notable_history=_combine(cell(r, C_DESC) for r in rows),
            source_notes=CSV_SOURCE_NOTE,
        )
        docs.append(entry.model_dump())

    if docs:
        await db.reference_entries.insert_many(docs)
    await db.seed_meta.insert_one({"key": CSV_IMPORT_KEY, "done": True, "count": len(docs), "imported_at": now_iso()})
    logger.info(f"Community CSV import complete: {len(docs)} reference entries added.")


@app.on_event("startup")
async def startup():
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — /api/scans/{id}/analyze will fail until it is configured.")
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI):
        logger.warning("Google OAuth env vars not set — login will fail until GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are configured.")
    await seed_data()
    try:
        await import_community_csv()
    except Exception as e:
        logger.error(f"Community CSV import failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"message": "RefCheck API", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
