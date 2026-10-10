# BrandShield AI — Project Plan

**Detect Impersonation. Protect Digital Identity.**

BrandShield AI is a hackathon Digital Risk Protection Platform. It helps teams catalog official brand assets, review lookalike social profiles, apps, and websites, and investigate suspicious findings with an explainable risk score.

## Honest scope

- Phase 1 is a **frontend demo**. It uses fictional sample data and browser storage. It does **not** live-scan social platforms, app stores, or the public internet.
- Similarity of a name or logo is a **signal**, not proof of fraud.
- **Risk** measures potential danger from available signals. **Confidence** measures how strongly the evidence supports that assessment. They are not the same.
- Victim counts and financial losses are shown only when the demo record explicitly includes them. Otherwise the UI shows **Unknown** or **Data Unavailable**.
- Verification badges in demo mode are **simulated / user-declared**. The product never claims independent verification without evidence.

## Technology (target)

| Layer | Choice |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend (Phase 2+) | Python + Flask |
| Database (Phase 3) | MySQL |
| Phase 1 persistence | `localStorage` + in-memory seed data |

No React, no Node.js app runtime, no unnecessary UI frameworks.

## Phases

### Phase 1 — Frontend demo (current priority)

Complete, attractive, functional dashboard that runs in a browser without login, email, API keys, or a database.

- Eight sections: Dashboard, Brand Profiler, Social Media Monitoring, App Store Monitoring, Website Monitoring, Threat Investigation, Alerts and Reports, Settings.
- Working navigation and primary actions.
- Loading, empty, error, and unavailable-source states.
- Modular local detection engine and explainable scoring.
- Demo mode with reset, clearly labeled simulated findings.

### Phase 2 — Flask API

Flask app that serves the frontend and exposes JSON APIs for brands, detections, investigations, reports, and settings. Input validation and safe error handling. Demo mode still works if the API is down (frontend falls back to local data).

### Phase 3 — MySQL persistence

Schema for brands, official assets, detections, cases, notes, allowlists, and scoring rules. Parameterized queries. Environment variables for secrets. Optional: run without MySQL by staying in demo/local mode.

### Phase 4 — Testing, security, demo prep

Broader tests, hardening notes, judge-ready README, and a verified demo script.

## Existing code preserved

A previous FastAPI + SQLite iteration lives under `backend/` (`legacy FastAPI`). Useful ideas kept:

- Explainable, rule-based scoring (no fake ML).
- Company-facing honesty about manual/local analysis.
- Evidence and status workflows.

Phase 2 replaces the public API surface with Flask. The FastAPI tree remains as reference until that migration is complete.

## Product sections

1. **Dashboard** — monitored brands/assets, severity mix, recent detections, source availability, scan history.
2. **Brand Profiler** — official names, domains, social accounts, apps, support channels, allowlist, simulated verification labels.
3. **Social Media Monitoring** — username/name/description/link signals on sample profiles.
4. **App Store Monitoring** — name, publisher, description, store-link signals on sample listings.
5. **Website Monitoring** — lookalike domains (typos, hyphens, extra characters, misleading subdomains).
6. **Threat Investigation** — case IDs, evidence, notes, statuses, related-campaign links.
7. **Alerts and Reports** — search, filters, CSV export, print-friendly summary.
8. **Settings** — scoring weights, demo reset, source status, data-honesty notes.

## Detection modules (implemented vs future)

| Check | Status |
| --- | --- |
| Username / display-name similarity | Implemented locally |
| Description and suspicious-term heuristics | Implemented locally |
| Suspicious links in sample bios | Implemented locally |
| Lookalike domain patterns | Implemented locally |
| App name / publisher / description comparison | Implemented locally |
| Simulated logo/icon hint (demo metadata) | Implemented as a labeled hint only |
| Live social graph / app-store / WHOIS / screenshot crawl | **Not implemented** — marked unavailable |
| Pixel-level logo matching / trained ML | **Not implemented** |

## Demo dataset (minimum)

Fictional brands and assets only (`.example` domains, invented handles):

- At least 3 brands
- At least 12 social profiles
- At least 10 mobile apps
- At least 8 lookalike or related domains
- At least 10 investigation cases

Includes official assets, suspicious impersonation examples, uncertain review-needed items, and false positives.
