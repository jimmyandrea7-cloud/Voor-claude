# RefCheck

AI-assisted vintage watch identification. Users upload guided photos + details of a watch (starting with **Omega**) and receive a structured identification report with a confidence score. A free preliminary result shows the likely model family and confidence; the full report is unlocked via a one-time Stripe payment. Admins curate an internal reference database, and the data model is multi-brand from day one.

- **Frontend:** React 19, React Router, Tailwind CSS, framer-motion, sonner
- **Backend:** FastAPI, Motor (async MongoDB)
- **AI:** OpenAI GPT-5.4 vision via the Emergent universal LLM key (`emergentintegrations`)
- **Auth:** Emergent-managed Google OAuth
- **Storage:** Emergent object storage for uploaded photos
- **Payments:** Stripe Checkout (one-time report unlock)

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URL` | yes | MongoDB connection string (e.g. `mongodb://localhost:27017`). |
| `DB_NAME` | yes | Database name used for all collections (e.g. `test_database`). |
| `EMERGENT_LLM_KEY` | yes | Universal key used for the GPT-5.4 vision analysis **and** to initialise object storage for photo uploads. |
| `ADMIN_EMAILS` | no | Comma-separated allowlist of emails that are granted admin rights (reference-DB + settings management) on first login. Leave empty to grant admin manually. |
| `STRIPE_SECRET_KEY` | yes (for payments) | Stripe secret key used to create Checkout sessions and read prices. |
| `STRIPE_PUBLISHABLE_KEY` | no | Stripe publishable key (kept for reference / future client use). |
| `STRIPE_WEBHOOK_SECRET` | yes (for payments) | Signing secret used to verify incoming Stripe webhooks at `/api/stripe/webhook`. |
| `STRIPE_ACCOUNT_ID` | no | Stripe account id (informational). |
| `STRIPE_MODE` | no | `test` or `live` (informational). |
| `REPORT_UNLOCK_LOOKUP_KEY` | no | Stripe Price `lookup_key` for the report unlock (default `report_unlock_single`). |
| `CORS_ORIGINS` | no | Comma-separated list of allowed CORS origins (default `*`). |
| `INTEGRATION_PROXY_URL` | no | Base URL of the Emergent integration proxy used for object storage. Falls back to the public integrations endpoint if unset. |

### Frontend (`frontend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | yes | Base URL of the backend. All API calls are made to `${REACT_APP_BACKEND_URL}/api`. |

> Secrets are never committed. When cloning fresh, recreate both `.env` files from the tables above.

---

## Running locally

### Prerequisites
- Python 3.11+
- Node.js 18+ and **Yarn**
- A running MongoDB instance

### Backend
```bash
cd backend
pip install -r requirements.txt
# create backend/.env with the variables listed above
# starts on 0.0.0.0:8001; all routes are prefixed with /api
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
On startup the backend seeds the Brands (Omega active; Rolex / Patek Philippe / Audemars Piguet as "coming soon") and a set of Omega reference entries (1930s–1970s), and initialises object storage.

### Stripe catalog (one-time)
Creates the product + price used for the report unlock:
```bash
python scripts/setup_stripe.py
```

### Frontend
```bash
cd frontend
yarn install
# create frontend/.env with REACT_APP_BACKEND_URL
yarn start   # dev server on port 3000
```

Open the frontend, sign in with Google, choose Omega, walk through the photo wizard, and run an identification.

---

## API overview
- `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/brands`, `GET/POST/PUT /api/brands` (admin for writes)
- `GET/POST/PUT/DELETE /api/reference-entries` (admin for writes)
- `POST /api/scans`, `GET /api/scans`, `GET /api/scans/{id}`, `PUT /api/scans/{id}/photos`, `PUT /api/scans/{id}/description`, `POST /api/scans/{id}/analyze`
- `POST /api/uploads`, `GET /api/files/{id}`
- `POST /api/payments/checkout`, `GET /api/payments/status/{session_id}`, `POST /api/stripe/webhook`
- `GET/PUT /api/settings`

## Disclaimer
RefCheck produces AI-assisted estimates for informational purposes only — not a certified appraisal or authentication. Always consult a professional (e.g. an Omega authorized dealer or certified watchmaker) before buying, selling, or insuring based on a report.
