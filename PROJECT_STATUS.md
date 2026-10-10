# BrandShield AI — Project Status

## Current phase
**Phase 2 (Flask API) implemented + verified.** The static-only demo entry point (`serve_demo.py`) remains available for Phase 1 judges who want a zero-setup workspace. The new Flask backend serves the same frontend from `/` and exposes the full JSON API surface. The existing FastAPI + SQLite code under `backend/app/main.py` is preserved as reference only and is no longer the primary API surface.

Demo mode stays usable when the Flask backend is not running: the frontend falls back to `localStorage` + the in-browser engine without errors.

## Already completed before this session

- [x] Inspected existing workspace and preserved the FastAPI tree + explainable-scoring approach.
- [x] Rewrote product docs for the Flask/MySQL phased plan and data-honesty rules.
- [x] Light enterprise dashboard: sidebar, cards, tables, risk badges, simple charts.
- [x] Eight working sections: Dashboard, Brand Profiler, Social, Apps, Websites, Investigation, Reports, Settings.
- [x] Demo mode banner, no login, localStorage persistence, demo reset.
- [x] Sample set: 3 brands, 14 social profiles, 11 apps, 10 website rows (8+ lookalikes), 12 cases.
- [x] Modular local engine: similarity, lure terms, publisher mismatch, lookalike domains, allowlist, official-sample exclusion.
- [x] Separate risk vs confidence; name-only similarity capped as review-needed.
- [x] Loading / empty / error / unavailable-source states.
- [x] CSV export and print-friendly report view.
- [x] Node selftest for dataset size and scoring rules (19/19 passing).
- [x] Phase 1 browser walkthrough sanity verified via selftest + API smoke against real server start.

## Completed in this session

- [x] Phase 2 — Flask API surface in `backend/app/flask_main.py`:
  - [x] Serves the Phase 1 frontend statically (`/`, `/app.html`, known asset paths)
  - [x] Security headers: CSP, X-Frame-Options, nosniff, strict referrer
  - [x] `/api/health` — stack, mode, and database scheme probe
  - [x] Auth endpoints (`/api/auth/*`) with demo-mode bypass so the no-login frontend works directly; cookie login still supported for non-demo deploy
  - [x] Company + brand profile CRUD (`/api/companies/me*`) with URL validation
  - [x] Scan + threat endpoints (`/api/scans`, `/api/threats`, threat notes, status patches) with string-length + char validation and reuses `services.risk_scoring.analyze_candidate`
  - [x] Incident / investigation endpoints (`/api/incidents*`) with severity + status enum validation and notes timelines
  - [x] Notifications endpoints and `/api/notifications/mark-all-read`
  - [x] Dashboard summary + charts endpoints
  - [x] CSV reports: `/api/reports/threats.csv` and `/api/reports/incidents.csv` (UTF-8 BOM for Excel)
  - [x] Evidence upload: `/api/evidence` with MIME allowlist, 5 MB cap, magic-byte checks, random hex filenames, ownership-gated download
  - [x] Opt-in synthetic demo seed endpoint `/api/demo/seed`
  - [x] Consistent JSON error bodies with `detail` field for 4xx/5xx
  - [x] Per-request ownership checks (`owned_threat`, `owned_incident`) scoped to the company
- [x] Demo mode auto-provisioning: first `/api/*` request creates the demo company, user, brand profile, 4 labeled synthetic threats, and a ready notification. `BRANDSHIELD_DEMO_MODE=true` skips cookie auth.
- [x] Reuses the preserved SQLAlchemy models, SQLite engine, password/session security helpers, and rule-based `risk_scoring` service from the legacy FastAPI tree. No duplicated business logic.
- [x] Frontend integration in `frontend/js/store.js` + `frontend/js/app.js`:
  - [x] `BS.probeApi()` — hits `/api/health` with a 2 s timeout; on success probes `/api/dashboard/summary` for backend counts; on failure silently continues
  - [x] `BS.apiFetch()` / `BS.apiBase()` / `BS.pushCandidate()` lightweight helpers with error and JSON handling
  - [x] Sidebar footer shows a live connection status pill (green ● Flask demo mode connected / ○ Offline local demo)
  - [x] Dashboard + Settings automatically rerender once the probe finishes
  - [x] All failures are silent; `localStorage`-only demo mode never breaks
- [x] Top-level convenience runner `run_flask.py` with optional `.env` loading
- [x] Updated `backend/requirements.txt` (Flask 3+, SQLAlchemy 2+, python-dotenv, pytest)
- [x] Updated `backend/.env.example` with SQLite default + MySQL Phase 3 placeholder
- [x] Verified via automated checks:
  - [x] 19/19 frontend node selftest passing
  - [x] Flask test client: 15/15 basic endpoint calls return 200/201
  - [x] Flask test client: 16/16 validation + CRUD flow tests (422/404 rejections, threat patch, incident create/patch, CSV row counts, notes, scans, mark-all-read)
  - [x] `py_compile` clean for `flask_main.py` + `run_flask.py`
  - [x] Real dev-server start on port 5050: HTTP 200 for `/api/health`, `/api/dashboard/summary`, `/app.html`

## Files created or modified this session

### Created
- `backend/app/flask_main.py` — Phase 2 Flask API (new primary backend entry)
- `run_flask.py` — top-level convenience runner that loads `.env` and starts Flask with the backend package on `sys.path`

### Modified
- `backend/requirements.txt` — swapped FastAPI for Flask, kept SQLAlchemy
- `backend/.env.example` — added `PORT`, kept SQLite default, MySQL example noted
- `frontend/js/store.js` — added `BS.apiFetch`, `BS.probeApi`, `BS.pushCandidate`, `BS.apiBase`; state tracks `apiAvailable`, `apiInfo`, `backendSummary`
- `frontend/js/app.js` — wired startup probe, connection status in sidebar footer, rerenders dashboard/settings after probe resolves; overrides `render()` to include the footer refresh
- `PROJECT_STATUS.md` (this file) and `README.md`

### Preserved untouched
- Legacy FastAPI tree: `backend/app/main.py`, `backend/app/schemas.py` (not wired to Flask)
- All Phase 1 frontend HTML/CSS, `demo-data.js`, `engine.js`, `ui.js`
- `serve_demo.py` static-only demo server (still works standalone)

## Remaining tasks (prioritized)

1. **Phase 3 — MySQL persistence** (highest next)
   - Swap SQLAlchemy engine URL from SQLite to `mysql+pymysql://...`.
   - Write `backend/schema.sql` / Alembic migrations for the 9 SQLAlchemy tables already in `models.py`.
   - Add parameterized-query smoke tests against a real MySQL local server.
   - Graceful DB-down fallback: continue serving local Phase 1 demo + clear "Database unavailable, using local demo only" banner.
   - Install guide for Windows: `choco install mysql` / `winget install Oracle.MySQL` + `CREATE DATABASE brandshield;` + `CREATE USER ...; GRANT ...;`

2. **Phase 3 follow-up — full two-way sync between frontend and Flask API**
   - Brand profile edits, new candidates, case statuses should write through `store.js` to the Flask API AND `localStorage` atomically.
   - Allowlist sync to `/api/threats` status `"Resolved"` or `"Closed"` flow.
   - CSV export from Reports page to hit `/api/reports/*.csv` when backend is connected.

3. **Phase 4 — hardening / judge readiness**
   - Pytest suite for Flask routes (`backend/tests/test_*_flask.py`) covering validation, ownership, CSV content, evidence upload/download
   - Session cookie review: refresh `SameSite`, `Secure` auto-detect when `BRANDSHIELD_COOKIE_SECURE` is on
   - Demo script: numbered judge walkthrough (Dashboard → Brands → Social → Websites → Investigation → Reports → CSV export → Settings reset + connected backend status)
   - Honesty statement copy-review on all screens (ensure no label implies live scanning)

4. **Low priority**
   - Delete (or clearly tag) the legacy FastAPI `main.py` once Flask replaces 100% of its surface and tests cover it.
   - Optional: `gunicorn` / `waitress` WSGI server production note for README.

## Known errors or limitations

- **Schema: `schemas.py` still uses Pydantic v2; Flask validation uses manual `trim_str()` + enum checks. No duplicated enforcement.** Pydantic is still a dependency via the legacy requirements but is not imported by `flask_main.py`. This is intentional to avoid a hard Pydantic requirement in Flask while we still preserve the FastAPI tree.
- **Legacy FastAPI auth pages** (`frontend/login.html`, `frontend/register.html`, `frontend/dashboard.html`, etc.) are still on disk from the previous iteration. They are not wired into either the demo entry path or the Flask `/` entry. Judges should use `index.html` → `app.html` (served by Flask or `serve_demo.py`).
- **Demo backend brand set is separate from the Phase 1 frontend demo.** Flask runs with a single synthetic company ("BrandShield AI Demo") + auto-seeded synthetic threats. The frontend local demo has the 3 fictional brands (AetherPay, LumenMart, NovaHealth). Both datasets are clearly labeled simulated and are not inventoried as one combined source. Phase 3 will reconcile them under MySQL-backed brand rows.
- **Logo "similarity" in any mode is a simulated hint, not pixel-level computer vision.**
- **Impact figures in demo records include reported victims only.** Confirmed victims/confirmed losses stay Unknown.
- **Evidence uploads save to `uploads/` on the local filesystem.** Phase 3 can move to MySQL BLOBs or object storage if judges ask.
- **Development server only (Flask `werkzeug`).** README warns against production deploy without a WSGI server + HTTPS.
- **Registration endpoint returns 403 in demo mode.** Use the auto-provisioned demo workspace directly.

## Exact Windows PowerShell commands to install dependencies and run

```powershell
# 0. Navigate into project root
cd C:\Users\DELL\Downloads\BrandShield-AI

# ---------------------------------------------------------------
# Option A — Phase 1 ONLY (zero setup, static demo, no backend)
# ---------------------------------------------------------------
python serve_demo.py
# then open http://127.0.0.1:5500/

# ---------------------------------------------------------------
# Option B — Phase 2 (Flask backend + API + same frontend +
#             optional MySQL later in Phase 3)
# ---------------------------------------------------------------
# 1. One-time: install backend dependencies into the existing .venv
#    (pip silently upgrades any packages already present)
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 2. Optional: copy backend\.env.example to .env (project root OR
#    backend\ folder both work) and tweak PORT, demo mode, etc.
Copy-Item backend\.env.example .env     # then edit values if desired

# 3. Start Flask backend (frontend served at the same origin)
.venv\Scripts\python.exe run_flask.py
# default -> http://127.0.0.1:5000/
#   with PORT=5050 in .env -> http://127.0.0.1:5050/

# 4. Verify the three critical URLs in a browser (or via PowerShell):
#    /            -> landing page
#    /app.html    -> workspace (auto-provisions demo company + 4 synthetic threats)
#    /api/health  -> JSON probe
Invoke-WebRequest http://127.0.0.1:5000/api/health -UseBasicParsing

# 5. Engine self-check (frontend dataset + scoring rules, independent of Flask):
node frontend\js\selftest.js

# 6. (Optional) Run the preserved pytest suite from the legacy FastAPI iteration:
.venv\Scripts\python.exe -m pytest backend\tests -q
# (Note: the legacy pytest suite targets FastAPI endpoints, not Flask.
#  A Flask-specific pytest suite is Phase 4 work.)
```

## Next recommended development step

Start **Phase 3 — MySQL persistence and full two-way sync**:

1. Install a local MySQL 8 server on Windows and export `BRANDSHIELD_DATABASE_URL=mysql+pymysql://user:pass@127.0.0.1:3306/brandshield`
2. Write an initialization script (`backend/init_db.sql`) or Alembic revisions that create the 9 tables from `models.py` with proper indexes and FK cascades.
3. Confirm `run_flask.py` starts cleanly against MySQL and all test-client smoke tests still pass (swap `DATABASE_URL` before each run).
4. Wire the Reports page CSV buttons in `ui.js` to call `/api/reports/*.csv` when `state.apiAvailable === true`; otherwise keep the existing localStorage-based CSV generator.
5. Add a banner to the Dashboard that combines local-demo counts + backend counts when both sources coexist, with a clear "(Backend connected)" / "(Local only)" label per metric group.
