# RefCheck

AI-assisted vintage watch identification. Users upload guided photos + details of a watch (starting with **Omega**) and receive a structured identification report with a confidence score. A free preliminary result shows the likely model family and confidence; the full report is unlocked via a one-time Stripe payment. Admins curate an internal reference database, and the data model is multi-brand from day one.

- **Frontend:** React 19, React Router, Tailwind CSS, framer-motion, sonner
- **Backend:** FastAPI, Motor (async MongoDB)
- **AI:** Anthropic Claude vision, called directly with your own API key
- **Auth:** Real Google OAuth (Authorization Code flow), self-hosted
- **Storage:** Local disk (`backend/uploads/`) for uploaded photos
- **Payments:** Stripe Checkout (one-time report unlock)

---

## Environment variables

### Backend (`backend/.env`)

See [`backend/.env.example`](backend/.env.example) for the full list with defaults. Key ones:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URL` | yes | MongoDB connection string (e.g. `mongodb://localhost:27017` or an Atlas URI). |
| `DB_NAME` | yes | Database name used for all collections. |
| `ADMIN_EMAILS` | no | Comma-separated allowlist of emails granted admin rights on first login. |
| `UPLOAD_DIR` | no | Local directory photos are written to (default `backend/uploads/`). |
| `MAX_UPLOAD_MB` | no | Per-photo upload size cap (default 10MB). |
| `ANTHROPIC_API_KEY` | yes (for AI analysis) | Your own Anthropic API key. Leave blank to keep AI analysis disabled — uploads/auth still work, `/analyze` returns a clear 503 instead of silently costing money. |
| `ANTHROPIC_MODEL` | no | Model id for vision analysis (default `claude-sonnet-5`). |
| `MAX_ANALYSES_PER_DAY_PER_USER` | no | Caps how many AI analyses one user can run per rolling 24h (default 10) — a guardrail against runaway API cost if the app is ever public. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | yes (for login) | Your own Google Cloud OAuth Web Client credentials. Leave blank to keep login disabled. |
| `FRONTEND_URL` | yes | Where to redirect the browser after a successful Google login (e.g. `http://localhost:3000`). |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | no | Session cookie flags. Use `false` / `lax` for local `http://` dev; `true` / `none` once deployed behind HTTPS. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | yes (for payments) | Your own Stripe secret key and webhook signing secret. Leave blank to keep payments disabled. |
| `REPORT_UNLOCK_LOOKUP_KEY` | no | Stripe Price `lookup_key` for the report unlock (default `report_unlock_single`). |
| `CORS_ORIGINS` | no | Comma-separated list of allowed CORS origins. |

### Frontend (`frontend/.env`)

See [`frontend/.env.example`](frontend/.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | yes | Base URL of the backend (e.g. `http://localhost:8001`). All API calls are made to `${REACT_APP_BACKEND_URL}/api`. |

> Secrets are never committed — both `.env` files are gitignored. Copy the `.env.example` files and fill in real values as you get each credential.

---

## Running locally

### Prerequisites
- Python 3.11+
- Node.js 18+ and **Yarn**
- A MongoDB instance (local, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)

Everything below runs with **empty** `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, and `STRIPE_SECRET_KEY` — the server starts fine and logs a warning for each; those features just return a clear error until you add real credentials. Nothing calls a paid API until you set a key yourself.

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# edit backend/.env — MONGO_URL/DB_NAME are the only two you need to get it running
# starts on 0.0.0.0:8001; all routes are prefixed with /api
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
On startup the backend seeds the Brands (Omega active; Rolex / Patek Philippe / Audemars Piguet as "coming soon") and a set of Omega reference entries (1930s–1970s).

### Stripe catalog (one-time, once you have real Stripe keys)
Creates the product + price used for the report unlock:
```bash
python scripts/setup_stripe.py
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env
yarn start   # dev server on port 3000
```

Open the frontend, sign in with Google, choose Omega, walk through the photo wizard, and run an identification.

---

## API overview
- `GET /api/auth/google/login`, `GET /api/auth/google/callback`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/brands`, `GET/POST/PUT /api/brands` (admin for writes)
- `GET/POST/PUT/DELETE /api/reference-entries` (admin for writes)
- `POST /api/scans`, `GET /api/scans`, `GET /api/scans/{id}`, `PUT /api/scans/{id}/photos`, `PUT /api/scans/{id}/description`, `POST /api/scans/{id}/analyze`
- `POST /api/uploads`, `GET /api/files/{id}`
- `POST /api/payments/checkout`, `GET /api/payments/status/{session_id}`, `POST /api/stripe/webhook`
- `GET/PUT /api/settings`

## Disclaimer
RefCheck produces AI-assisted estimates for informational purposes only — not a certified appraisal or authentication. Always consult a professional (e.g. an Omega authorized dealer or certified watchmaker) before buying, selling, or insuring based on a report.
