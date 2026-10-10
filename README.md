# BrandShield AI

**Detect Impersonation. Protect Digital Identity.**

A hackathon Digital Risk Protection dashboard for cataloging official brand assets, reviewing lookalike social profiles, apps, and websites, and investigating suspicious findings with an explainable risk score.

> **Honesty:** Phase 1 is a **browser demo**. Findings are simulated from local sample data and a rule-based engine. The app does **not** live-scan social platforms, app stores, or the public internet. A similar name or logo is **not** proof of fraud. **Risk** (potential danger) and **confidence** (evidence strength) are separate. Victim and loss figures are **Unknown** unless a demo record explicitly includes them.
>
> **Phase 2 adds a Flask JSON API** that serves the same frontend plus persistent brands, threats, investigations, CSV reports, and evidence uploads. If the Flask backend is down, the frontend falls back to `localStorage` demo mode automatically — no login required, no data lost.

## Quick start

### Option 1 — Phase 1 only (zero setup, static demo)

Python 3 is enough:

```powershell
cd BrandShield-AI
python serve_demo.py
```

Open [http://127.0.0.1:5500/](http://127.0.0.1:5500/) and choose **Enter demo workspace**.

Or open `frontend/index.html` / `frontend/app.html` through any static file server.

### Option 2 — Phase 2 (Flask backend + same frontend + persistent API)

```powershell
cd BrandShield-AI

# One-time install (reuses the existing .venv; pip silently upgrades existing deps)
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Optional: copy backend\.env.example to .env in project root or backend\
Copy-Item backend\.env.example .env

# Start the Flask server (serves frontend + JSON API from the same origin)
.venv\Scripts\python.exe run_flask.py
```

Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/).

In demo mode (`BRANDSHIELD_DEMO_MODE=true`, the default), the first request to any API endpoint auto-creates a clearly-labeled synthetic workspace (BrandShield AI Demo company, 4 sample threats, a ready notification, a brand profile). **No login is required.** Cookie-based auth still exists under `/api/auth/*` and activates when you flip `BRANDSHIELD_DEMO_MODE=false` in `.env`.

Verify the endpoints:

```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing
# Expected status 200, JSON with status:"ok" + stack:"Flask + SQLAlchemy"
Invoke-WebRequest http://127.0.0.1:5000/api/dashboard/summary -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5000/app.html -UseBasicParsing
```

### Demo reset

Settings → **Reset demo data**. This restores the fictional AetherPay, LumenMart, and NovaHealth workspace and clears this browser's saved edits (`localStorage`).

To reset the **Flask backend** demo data, delete the SQLite DB file (default `brandshield.db` next to `run_flask.py`) and restart Flask. The next `/api/*` request re-seeds the synthetic workspace.

### Engine self-check (frontend dataset + scoring rules)

```powershell
node frontend\js\selftest.js
```

Expected: `All self-checks passed.` (19 checks covering brand count, social/app/domain counts, risk-separation caps, allowlist behavior, false-positive handling, and similarity normalization).

## What you can do in the demo

1. Dashboard — brand/asset counts, severity mix, source availability, simulated scan history, **Flask backend connectivity pill** (green ● = connected, ○ = local only).
2. Brand Profiler — create/edit brands, official social accounts, apps, domains, support channels, allowlist.
3. Social / App / Website monitoring — filters, evidence, allowlist, add a local candidate.
4. Threat Investigation — case IDs, notes, statuses (open, investigating, resolved, dismissed, false-positive), campaign links. **When the Flask backend is connected it additionally persists via `/api/threats/*` and `/api/incidents/*` ownership-scoped endpoints.**
5. Alerts and Reports — search, filters, CSV export, print-friendly summary.
6. Settings — scoring weights, implemented vs future checks, demo reset.

Verification badges say **simulated demo** or **user-declared**. They are not independent proof of ownership.

## Feature matrix (all phases)

| Feature | Phase 1 (localStorage) | Phase 2 (Flask + SQLite) | Phase 3 (MySQL, planned) |
| --- | --- | --- | --- |
| Eight dashboard sections | ✅ | ✅ | ✅ |
| Frontend + CSP + security headers | via static server | ✅ Flask `after_request` | ✅ |
| Explainable risk + confidence | ✅ engine.js | ✅ (reuses `services.risk_scoring`) | ✅ |
| Brand profiles + allowlist | ✅ local | ✅ `/api/companies/me/brand-profile` | ✅ |
| Social / App / Website detections | ✅ sample data | ✅ `/api/threats` + scan on POST | ✅ |
| Threat notes + status patches | ✅ local | ✅ `/api/threats/<id>/notes` + PATCH | ✅ |
| Incident / investigation timeline | ✅ local | ✅ `/api/incidents*` | ✅ |
| Notifications | ✅ local | ✅ `/api/notifications` + mark-all-read | ✅ |
| Dashboard summary + charts | ✅ local counts | ✅ `/api/dashboard/summary`, `/api/dashboard/charts` | ✅ |
| CSV reports (threats + incidents) | ✅ browser-generated | ✅ `/api/reports/*.csv` UTF-8 BOM | ✅ |
| Evidence file upload (5 MB cap, MIME + magic-byte check) | ❌ | ✅ `/api/evidence` + ownership-gated download | ✅ |
| Synthetic demo seed endpoint | ❌ | ✅ `/api/demo/seed` | ✅ |
| Live social/app store / domain scanning | ❌ | ❌ explicitly unavailable | ❌ not planned |
| MySQL persistence | N/A | SQLite default via SQLAlchemy | ✅ `mysql+pymysql://...` |
| Two-way state sync frontend ↔ backend | N/A | backend probe + status pill only | ✅ full CRUD sync |

## Project layout

```
BrandShield-AI/
├── frontend/                      # Vanilla HTML, CSS, JavaScript dashboard
│   ├── index.html                 # Landing page → Enter demo workspace
│   ├── app.html                   # Workspace SPA entry (8 sections, sidebar, topbar)
│   ├── css/app.css tokens.css base.css …
│   └── js/
│       ├── utils.js, ui.js, app.js
│       ├── demo-data.js           # Fictional AetherPay / LumenMart / NovaHealth sample set
│       ├── engine.js              # Local rule-based detection + explainable scoring
│       ├── store.js               # localStorage persistence + Phase 2 BS.probeApi / BS.apiFetch / BS.pushCandidate
│       ├── auth.js (unused legacy)
│       ├── api-client.js (legacy helper; Phase 2 uses store.js wrappers)
│       └── selftest.js            # Node dataset + scoring self-check
├── backend/
│   ├── app/
│   │   ├── flask_main.py          # **Phase 2 primary entry: Flask API + static frontend**
│   │   ├── main.py                # Preserved legacy FastAPI reference (not run)
│   │   ├── config.py              # Environment variables (DB URL, session, demo mode, upload dir)
│   │   ├── database.py            # SQLAlchemy engine + SessionLocal (works for SQLite + MySQL URL)
│   │   ├── models.py              # SQLAlchemy models (Company, User, BrandProfile, Threat, Incident, Notification, ScanRun, ThreatNote, SessionRecord)
│   │   ├── schemas.py             # Preserved Pydantic schemas (FastAPI reference)
│   │   ├── security.py            # scrypt password hashing + session token helpers
│   │   ├── services/risk_scoring.py  # Rule-based analyze_candidate, similarity, lookalike-domain heuristics
│   │   ├── utils/seed_demo_data.py   # CLI helper: legacy FastAPI demo user seed
│   │   └── routers/ (empty legacy)
│   ├── tests/                     # Preserved legacy FastAPI pytest suite
│   ├── requirements.txt           # Flask 3 + SQLAlchemy 2 + python-dotenv + pytest
│   └── .env.example               # SQLite default URL + MySQL placeholder + PORT
├── serve_demo.py                  # Phase 1 static-only file server (port 5500, no backend)
├── run_flask.py                   # Phase 2 convenience runner: loads .env, starts Flask on PORT=5000 default
├── PROJECT_PLAN.md / PROJECT_STATUS.md  # Phased plan + verified increment status
└── README.md (this file)
```

## Environment variables

Copy `backend/.env.example` → `.env` in the project root or `backend\` folder. All variables have sensible defaults for local development:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BRANDSHIELD_DATABASE_URL` | `sqlite:///./brandshield.db` | SQLAlchemy URL. Phase 3: `mysql+pymysql://user:pass@127.0.0.1:3306/brandshield` |
| `BRANDSHIELD_DEMO_MODE` | `true` | When true all API calls use the auto-provisioned demo workspace and no login cookie is required |
| `BRANDSHIELD_SESSION_COOKIE` | `brandshield_session` | Cookie name |
| `BRANDSHIELD_COOKIE_SECURE` | `false` | Flip to `true` on HTTPS deployments |
| `BRANDSHIELD_SESSION_HOURS` | `12` | Cookie / session lifetime |
| `PORT` | `5000` | HTTP port used by `run_flask.py` |

## Security notes

### Phase 1 (static demo)
- No secrets, no authentication, no network fetches of candidate URLs (avoids turning the demo into an SSRF toy).
- HTML is escaped in the UI helpers (`BS.escapeHtml` / BS store helpers / ui.js renderers).
- Do not present demo scores as court-ready attribution.

### Phase 2 (Flask + SQLite / future MySQL)
- All API payloads are length-capped via `trim_str` helpers. Enums (threat status, incident status, severity) are whitelist-checked.
- URLs in brand profiles must start `http://` or `https://`.
- SQLAlchemy ORM is used for all persistence (parameterized queries; no raw SQL string concatenation).
- Uploaded evidence is restricted to PNG/JPEG/WebP/TXT/PDF, 5 MB cap, with magic-byte signature checks (not MIME or extension trust). Files are stored with random hex filenames (`secrets.token_hex(20) + ext`) in `uploads/`. Downloads are scoped to the current company via threat ownership.
- Session tokens are `secrets.token_urlsafe(36)`, stored SHA-256 hashed, passwords with per-password salted `scrypt` (`n=2^14, r=8, p=1, dklen=32`).
- Security headers (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, frame-ancestors) are applied to every response via `@app.after_request`.
- Known gaps (Phase 4): CSRF tokens, rate limiting, and full WSGI deployment behind a TLS proxy. Do not expose the Flask `werkzeug` dev server to the public internet.

## Later phases (phased plan)

| Phase | Status |
| --- | --- |
| 1. Frontend demo | ✅ **Implemented** (`frontend/` + `serve_demo.py`, 19/19 selftest passing) |
| 2. Flask API | ✅ **Implemented** (this session's `flask_main.py` + `run_flask.py`; 15 basic smoke + 16 validation/CRUD tests passing via test client; verified HTTP 200 on live start) |
| 3. MySQL persistence | ⏳ Not started (SQLite default works today; swap URL in `.env` + init schema = Phase 3 start) |
| 4. Hardening / extra tests / judge demo script | ⏳ Partial (Node selftest + Flask smoke only so far; Flask pytest suite = Phase 4) |

A previous FastAPI + SQLite iteration remains under `backend/app/main.py` as reference. It is **not** required for any Phase 1 or Phase 2 entry point. The target backend for Phase 2+ is **Flask**, with **MySQL** targeted for Phase 3.

## Run commands recap (Windows PowerShell)

```powershell
cd C:\Users\DELL\Downloads\BrandShield-AI

# Static demo only (fastest option for judges)
python serve_demo.py

# Flask backend + frontend + API
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.venv\Scripts\python.exe run_flask.py
# open http://127.0.0.1:5000/app.html

# Frontend engine self-check
node frontend\js\selftest.js
```
