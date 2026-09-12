# RefCheck — Product Requirements Document

## Original problem statement
Build "RefCheck", a web app that helps people identify a vintage watch from photos and details, starting with Omega, designed to expand to other brands without rearchitecting. Users upload guided photos + description of an inherited/found watch and receive an AI-generated identification report with a confidence score. A free preliminary result (model family + confidence %) is shown; the full report is behind a paywall. Admins curate an internal ReferenceEntries knowledge table. Every report carries a legal disclaimer.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind, framer-motion, sonner. Dark navy / gold "expert appraiser" theme, mobile-first.
- **Backend**: FastAPI + Motor (MongoDB). UUID string ids, `_id` always projected out.
- **Auth**: Emergent-managed Google OAuth (session_token cookie + Bearer fallback). `is_admin` flag on users (seeded from `ADMIN_EMAILS`).
- **AI**: OpenAI GPT 5.4 vision via Emergent universal key (`emergentintegrations` LlmChat) — analyzes photos + text, cross-references seeded reference DB, returns structured JSON.
- **Storage**: Emergent object storage for uploaded photos.
- **Payments**: Stripe claimable sandbox (Flow A), SMP/full tax mode. One-time "unlock report" (`report_unlock_single`, $9.99, configurable display price). Subscription tier placeholder in settings.

## User personas
- **Owner/inheritor**: non-expert who found an old watch, wants to know what it is and roughly what it's worth.
- **Admin/curator**: expands the reference database and manages pricing.

## Core requirements (static)
- Multi-brand data model (Brands, ReferenceEntries, Scans, Users) — add a brand + entries, no code change.
- Guided 7-slot photo wizard (4 required), description questionnaire.
- Free preliminary result vs paid full report (server-side gating).
- Legal disclaimer on every report.

## Implemented (2026-06)
- Auth (Google), brands (Omega active + 3 coming soon), 5 seeded Omega reference families.
- Photo upload to object storage, scan lifecycle, GPT-5.4 vision analysis with DB cross-reference + confidence breakdown.
- Free-tier gating + Stripe checkout unlock + payment status polling + webhook.
- User dashboard (My Collection), Admin reference DB CRUD + search/filter + price settings.
- Full report rendering (reference, era, confidence breakdown, authenticity signals, valuation, condition, story) + disclaimer.
- Tested: backend 21/21 pass; frontend flows incl. admin modal CRUD 100%.

## Backlog (P1/P2)
- PDF export of reports; scan comparison drawer.
- Real subscription tier (recurring Stripe price) wired to unlimited unlocks.
- Per-user access control on `/api/files/{id}` (currently public-by-UUID).
- Additional brands' reference data (Rolex, Patek, AP).
- Migrate FastAPI `on_event` to lifespan handlers.

## Next tasks
- Gather user feedback on AI accuracy and report layout.
- Populate more Omega reference entries for better DB matches.
