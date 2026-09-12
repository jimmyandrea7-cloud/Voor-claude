"""RefCheck backend — vintage watch identification (multi-brand ready, Omega at launch)."""
import os
import json
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import requests
import stripe
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Header, Query, Depends
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("refcheck")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
REPORT_LOOKUP_KEY = os.environ.get("REPORT_UNLOCK_LOOKUP_KEY", "report_unlock_single")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# ----- Object storage -----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "refcheck"
_storage_key = None

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


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
    provenance: Optional[str] = ""
    engravings: Optional[str] = ""
    condition: Optional[str] = "unknown"
    box_papers: Optional[str] = "unsure"
    caseback_numbers: Optional[str] = ""


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


@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}, timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        is_admin = existing.get("is_admin", False) or email in ADMIN_EMAILS
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data["name"], "picture": data.get("picture"), "is_admin": is_admin}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        is_admin = email in ADMIN_EMAILS
        await db.users.insert_one(User(user_id=user_id, email=email, name=data["name"], picture=data.get("picture"), is_admin=is_admin).model_dump())
    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token, "expires_at": expires_at.isoformat(), "created_at": now_iso()})
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 3600)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**user_doc)


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
    "report_price_display": "$9.99",
    "report_price_amount": 9.99,
    "report_currency": "usd",
    "subscription_enabled": False,
    "subscription_price_display": "$4.99/mo",
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
    """Only expose model family + confidence for the free tier."""
    return {
        "likely_model_family": result.get("likely_model_family"),
        "confidence_percentage": result.get("confidence_percentage"),
        "headline_highlights": result.get("headline_highlights", []),
        "used_database_match": result.get("used_database_match", False),
        "low_confidence": result.get("confidence_percentage", 0) < 40,
        "additional_photo_suggestion": result.get("additional_photo_suggestion"),
        "locked": True,
    }


# ============================ AI Analysis ============================
ANALYSIS_SCHEMA_HINT = """Return ONLY valid minified JSON (no markdown fences) with EXACTLY these keys:
{
 "likely_model_family": string,
 "likely_reference_numbers": [string],  // ranked most→least likely
 "estimated_period": string,            // e.g. "1965-1969"
 "confidence_percentage": number,       // 0-100 integer
 "confidence_breakdown": [string],      // each item like "serial matched known range: +30%"
 "authenticity_signals": [string],      // non-definitive signals, plain language
 "estimated_value_range": string,       // rough range + disclaimer this is not a formal appraisal
 "condition_notes": [string],
 "story": string,                       // 2-4 sentences of historical context
 "used_database_match": boolean,        // true if a DB serial range / reference matched
 "headline_highlights": [string],       // 2-3 short visual cues that drove the guess
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


@api.post("/scans/{scan_id}/analyze")
async def analyze_scan(scan_id: str, user: User = Depends(get_current_user)):
    doc = await _get_owned_scan(scan_id, user)
    scan = Scan(**doc)
    if not scan.photos:
        raise HTTPException(status_code=400, detail="Upload at least one photo before analysis")

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
            data, _ = get_object(rec["storage_path"])
            images.append(ImageContent(image_base64=base64.b64encode(data).decode()))
            photo_labels.append(p.slot)
        except Exception as ex:
            logger.warning(f"skip image {p.file_id}: {ex}")

    d = scan.description
    user_text = f"""You are identifying a vintage {brand_name} watch from user photos and details.

PHOTOS PROVIDED (in order): {', '.join(photo_labels) or 'none'}

USER DESCRIPTION:
- Provenance/context: {d.provenance or 'n/a'}
- Visible engravings/text: {d.engravings or 'n/a'}
- Condition: {d.condition or 'unknown'}
- Original box/papers: {d.box_papers or 'unsure'}
- Numbers on caseback/dial: {d.caseback_numbers or 'n/a'}

INTERNAL {brand_name.upper()} REFERENCE DATABASE (cross-reference any extracted serial/reference numbers against these):
{ref_context}

INSTRUCTIONS:
1. Analyze the photos for {brand_name} design language, typography, case shape, hands, dial, crown, bracelet, era-typical features.
2. Extract any serial/reference numbers from the photos or the user's text.
3. Cross-reference against the reference database above. If a serial range or reference number matches, weight it heavily and set used_database_match=true. If nothing matches, rely on visual reasoning and set used_database_match=false, and say so.
4. In estimated_value_range, always include a clear disclaimer that it is not a formal appraisal.
5. Phrase authenticity_signals as non-definitive signals, never a certified authentication.
6. If confidence < 40, set additional_photo_suggestion to the single most useful extra photo/detail.

{ANALYSIS_SCHEMA_HINT}"""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"scan_{scan_id}",
        system_message="You are an expert vintage watch appraiser and horologist specializing in identifying watches from photographs. You are precise, cautious, and never claim certified authentication. You always answer with strictly valid JSON.",
    ).with_model("openai", "gpt-5.4")

    message = UserMessage(text=user_text, file_contents=images if images else None)
    try:
        raw = await chat.send_message(message)
    except Exception as ex:
        logger.exception("LLM analysis failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {ex}")

    result = parse_json_result(raw)
    conf = float(result.get("confidence_percentage") or 0)
    await db.scans.update_one({"id": scan_id}, {"$set": {"result": result, "confidence_score": conf, "status": "analyzed"}})

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
    data.setdefault("likely_model_family", "Undetermined")
    data.setdefault("likely_reference_numbers", [])
    data.setdefault("estimated_period", "Unknown")
    data.setdefault("confidence_percentage", 0)
    data.setdefault("confidence_breakdown", [])
    data.setdefault("authenticity_signals", [])
    data.setdefault("estimated_value_range", "Unable to estimate. Not a formal appraisal.")
    data.setdefault("condition_notes", [])
    data.setdefault("story", "")
    data.setdefault("used_database_match", False)
    data.setdefault("headline_highlights", [])
    data.setdefault("additional_photo_suggestion", "")
    try:
        data["confidence_percentage"] = int(round(float(data["confidence_percentage"])))
    except Exception:
        data["confidence_percentage"] = 0
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


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await seed_data()


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
