"""RefCheck backend API tests - covers auth, brands, reference entries, scans, uploads, AI analyze, payments, settings."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dial-detective-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Seeded/created tokens (see conftest for provisioning if missing)
USER_TOKEN = os.environ.get("USER_TOKEN", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def _provision_tokens():
    """Provision fresh test tokens by writing directly to MongoDB via mongosh."""
    import subprocess
    ts = int(time.time() * 1000)
    user_id = f"user_test_{ts}"
    admin_id = f"user_admin_{ts}"
    user_token = f"test_session_{ts}"
    admin_token = f"admin_session_{ts}"
    js = f"""
use('test_database');
db.users.insertOne({{user_id:'{user_id}',email:'tester_{ts}@example.com',name:'Test Tester',picture:'',is_admin:false,created_at:new Date().toISOString()}});
db.users.insertOne({{user_id:'{admin_id}',email:'admin_{ts}@example.com',name:'Admin',picture:'',is_admin:true,created_at:new Date().toISOString()}});
db.user_sessions.insertOne({{user_id:'{user_id}',session_token:'{user_token}',expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()}});
db.user_sessions.insertOne({{user_id:'{admin_id}',session_token:'{admin_token}',expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()}});
"""
    subprocess.run(["mongosh", "--quiet", "--eval", js], check=True, capture_output=True)
    return user_token, admin_token


@pytest.fixture(scope="session")
def tokens():
    ut, at = USER_TOKEN, ADMIN_TOKEN
    if not ut or not at:
        ut, at = _provision_tokens()
    return {"user": ut, "admin": at}


@pytest.fixture(scope="session")
def user_headers(tokens):
    return {"Authorization": f"Bearer {tokens['user']}"}


@pytest.fixture(scope="session")
def admin_headers(tokens):
    return {"Authorization": f"Bearer {tokens['admin']}"}


# ---------------- Health ----------------
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------- Brands ----------------
class TestBrands:
    def test_list_brands_seeded(self):
        r = requests.get(f"{API}/brands")
        assert r.status_code == 200
        brands = r.json()
        names = [b["name"] for b in brands]
        assert "Omega" in names
        assert "Rolex" in names
        assert "Patek Philippe" in names
        assert "Audemars Piguet" in names
        omega = next(b for b in brands if b["name"] == "Omega")
        assert omega["active"] is True
        rolex = next(b for b in brands if b["name"] == "Rolex")
        assert rolex["active"] is False
        assert rolex.get("coming_soon_label")


@pytest.fixture(scope="session")
def omega_id():
    r = requests.get(f"{API}/brands")
    for b in r.json():
        if b["name"] == "Omega":
            return b["id"]
    pytest.fail("Omega brand missing")


@pytest.fixture(scope="session")
def rolex_id():
    r = requests.get(f"{API}/brands")
    for b in r.json():
        if b["name"] == "Rolex":
            return b["id"]
    pytest.fail("Rolex brand missing")


# ---------------- Reference entries ----------------
class TestReferenceEntries:
    def test_list_seeded_omega(self, omega_id):
        r = requests.get(f"{API}/reference-entries", params={"brand_id": omega_id})
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 5
        families = [e["model_family"] for e in entries]
        assert any("Speedmaster" in f for f in families)
        # verify serial ranges/periods present
        speed = next(e for e in entries if "Speedmaster" in e["model_family"])
        assert speed["serial_range_start"]
        assert speed["production_period"]

    def test_admin_gating_non_admin(self, user_headers, omega_id):
        payload = {"brand_id": omega_id, "model_family": "TEST_family"}
        r = requests.post(f"{API}/reference-entries", json=payload, headers=user_headers)
        assert r.status_code == 403

    def test_admin_can_crud(self, admin_headers, omega_id):
        payload = {"brand_id": omega_id, "model_family": "TEST_family_" + uuid.uuid4().hex[:6],
                   "reference_numbers": ["TEST-001"], "production_period": "1999-2000"}
        r = requests.post(f"{API}/reference-entries", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["model_family"] == payload["model_family"]
        eid = entry["id"]

        # update
        payload["model_family"] = payload["model_family"] + "_v2"
        r = requests.put(f"{API}/reference-entries/{eid}", json=payload, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["model_family"].endswith("_v2")

        # get to confirm persistence
        r = requests.get(f"{API}/reference-entries", params={"brand_id": omega_id})
        assert any(e["id"] == eid and e["model_family"].endswith("_v2") for e in r.json())

        # delete
        r = requests.delete(f"{API}/reference-entries/{eid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Auth ----------------
class TestAuth:
    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, user_headers):
        r = requests.get(f"{API}/auth/me", headers=user_headers)
        assert r.status_code == 200
        u = r.json()
        assert "user_id" in u and "email" in u
        assert u["is_admin"] is False

    def test_me_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_admin"] is True


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        data = r.json()
        assert "report_price_display" in data
        assert "report_price_amount" in data

    def test_update_settings_non_admin_forbidden(self, user_headers):
        r = requests.put(f"{API}/settings", json={"report_price_display": "$1.00"}, headers=user_headers)
        assert r.status_code == 403

    def test_update_settings_admin(self, admin_headers):
        original = requests.get(f"{API}/settings").json()
        new_display = "$9.99"
        r = requests.put(f"{API}/settings", json={"report_price_display": new_display}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["report_price_display"] == new_display
        # restore
        requests.put(f"{API}/settings", json={"report_price_display": original["report_price_display"]}, headers=admin_headers)


# ---------------- Scans ----------------
class TestScans:
    def test_create_scan_inactive_brand(self, user_headers, rolex_id):
        r = requests.post(f"{API}/scans", json={"brand_id": rolex_id}, headers=user_headers)
        assert r.status_code == 400

    def test_create_scan_ok(self, user_headers, omega_id):
        r = requests.post(f"{API}/scans", json={"brand_id": omega_id}, headers=user_headers)
        assert r.status_code == 200
        s = r.json()
        assert s["status"] == "draft"
        assert s["paid"] is False
        assert s["brand_id"] == omega_id

    def test_scan_requires_auth(self, omega_id):
        r = requests.post(f"{API}/scans", json={"brand_id": omega_id})
        assert r.status_code == 401


@pytest.fixture(scope="session")
def scan_id(user_headers, omega_id):
    r = requests.post(f"{API}/scans", json={"brand_id": omega_id}, headers=user_headers)
    assert r.status_code == 200
    return r.json()["id"]


# ---------------- Uploads ----------------
@pytest.fixture(scope="session")
def uploaded_file(user_headers):
    with open("/tmp/watch.jpg", "rb") as f:
        r = requests.post(f"{API}/uploads", files={"file": ("watch.jpg", f, "image/jpeg")}, headers=user_headers)
    assert r.status_code == 200, r.text
    return r.json()


class TestUploads:
    def test_upload_ok(self, uploaded_file):
        assert "file_id" in uploaded_file
        assert uploaded_file["content_type"] == "image/jpeg"

    def test_download(self, uploaded_file):
        r = requests.get(f"{API}/files/{uploaded_file['file_id']}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 1000


# ---------------- Scan photos / description / analysis ----------------
class TestScanFlow:
    def test_update_photos(self, user_headers, scan_id, uploaded_file):
        payload = {"photos": [{"slot": "dial", "file_id": uploaded_file["file_id"],
                               "storage_path": uploaded_file["storage_path"]}]}
        r = requests.put(f"{API}/scans/{scan_id}/photos", json=payload, headers=user_headers)
        assert r.status_code == 200
        assert len(r.json()["photos"]) == 1
        # GET verifies persistence
        r = requests.get(f"{API}/scans/{scan_id}", headers=user_headers)
        assert r.status_code == 200
        assert len(r.json()["photos"]) == 1

    def test_update_description(self, user_headers, scan_id):
        payload = {"provenance": "Grandfather's", "engravings": "OMEGA", "condition": "good",
                   "box_papers": "no", "caseback_numbers": "145.022"}
        r = requests.put(f"{API}/scans/{scan_id}/description", json=payload, headers=user_headers)
        assert r.status_code == 200
        assert r.json()["description"]["provenance"] == "Grandfather's"

    @pytest.mark.timeout(120)
    def test_analyze(self, user_headers, scan_id):
        r = requests.post(f"{API}/scans/{scan_id}/analyze", headers=user_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "analyzed"
        result = data["result"]
        # Free-tier gating: only limited fields present
        assert "likely_model_family" in result
        assert "confidence_percentage" in result
        assert result.get("locked") is True
        # Paywalled fields must be absent
        for gated in ("estimated_value_range", "story", "authenticity_signals", "condition_notes",
                      "confidence_breakdown", "likely_reference_numbers"):
            assert gated not in result, f"Free tier leaked {gated}"

    def test_get_scan_still_gated(self, user_headers, scan_id):
        r = requests.get(f"{API}/scans/{scan_id}", headers=user_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["paid"] is False
        assert data["result"].get("locked") is True


# ---------------- Payments ----------------
class TestPayments:
    def test_checkout(self, user_headers, scan_id):
        r = requests.post(f"{API}/payments/checkout",
                          json={"scan_id": scan_id, "origin_url": BASE_URL}, headers=user_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["checkout_url"].startswith("http")
        assert data["session_id"]
        # status
        s = requests.get(f"{API}/payments/status/{data['session_id']}")
        assert s.status_code == 200
        sdata = s.json()
        assert sdata["payment_status"] in ("pending", "unpaid", "initiated")
        assert sdata["scan_id"] == scan_id
