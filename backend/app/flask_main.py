"""BrandShield AI — Phase 2 Flask backend.

Serves the Phase 1 frontend and exposes a JSON API for brands, threats,
investigations, reports, and dashboard metrics.

Honesty: analysis is rule-based; no live internet scanning. Findings that are
synthetic are clearly labeled. Demo mode skips cookie-based auth so the
no-login frontend can use the API directly.

Reuses the existing SQLAlchemy models, database engine, security helpers,
and risk scoring service from the preserved FastAPI tree.
"""
from __future__ import annotations

import csv
import io
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, request, send_file, send_from_directory
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

# Reuse backend modules preserved from the FastAPI iteration.
from .config import (
    COOKIE_SECURE,
    DEMO_MODE,
    FRONTEND_DIR,
    SESSION_COOKIE,
    SESSION_HOURS,
    UPLOAD_DIR,
)
from .database import Base, SessionLocal, engine
from . import models  # type: ignore[attr-defined]
from .security import hash_password, new_session, hash_token, verify_password
from .services.risk_scoring import analyze_candidate

# ---------------------------------------------------------------------------
# Flask app setup
# ---------------------------------------------------------------------------

Base.metadata.create_all(bind=engine)

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024  # 6 MB for evidence uploads.

DEMO_EMAIL = "demo@brandshield.test"
DEMO_PASSWORD = "DemoPass123!"


# ---------------------------------------------------------------------------
# Small validation + error helpers
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
VALID_THREAT_STATUS = {
    "New", "Under Investigation", "Awaiting Review",
    "Report Prepared", "Resolved", "Closed",
}
VALID_INCIDENT_STATUS = {"Open", "Investigating", "Awaiting Review", "Resolved", "Closed"}
VALID_SEVERITY = {"Low", "Medium", "High", "Critical"}


def valid_email(value: str) -> bool:
    return bool(EMAIL_RE.fullmatch((value or "").strip()))


def trim_str(value: Any, max_len: int) -> str:
    return (str(value) if value is not None else "").strip()[:max_len]


def get_json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        _error(400, "JSON body required.")
    return data


def _error(status: int, detail: str) -> None:
    """Abort the current request with a consistent JSON error body."""
    resp = Response(response=__import__("json").dumps({"detail": detail}),
                    status=status, mimetype="application/json")
    __import__("flask").abort(resp)


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------

@app.after_request
def security_headers(response: Response) -> Response:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: blob:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    return response


# ---------------------------------------------------------------------------
# Demo-mode bootstrap + request context helpers
# ---------------------------------------------------------------------------

def ensure_demo_company(db: Session) -> tuple:
    """Create the demo user + company + brand profile the first time."""
    user = db.scalar(select(models.User).where(models.User.email == DEMO_EMAIL))
    if user:
        return user, user.company

    company = models.Company(
        name="BrandShield AI Demo",
        industry="Demo Workspace",
        website="https://brandshield.example",
        email=DEMO_EMAIL,
        description="Auto-provisioned demo company used when BRANDSHIELD_DEMO_MODE=true.",
    )
    db.add(company); db.flush()

    user = models.User(
        company_id=company.id,
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        role="admin",
    )
    brand = models.BrandProfile(
        company_id=company.id,
        official_name=company.name,
        official_website=company.website,
        official_domains=["brandshield.example"],
        verification_status="unverified",
    )
    db.add_all([user, brand])
    db.flush()
    samples = [
        ("brandshiled.example", "website", "New"),
        ("brandshield-offers.example", "website", "Under Investigation"),
        ("@brandshield_support", "social profile", "Awaiting Review"),
        ("@brandshield_officialhelp", "social profile", "New"),
    ]
    brand_data = {
        "official_name": brand.official_name,
        "alternative_names": [],
        "official_website": brand.official_website,
        "official_domains": list(brand.official_domains or []),
        "verification_status": brand.verification_status,
    }
    for candidate, typ, status in samples:
        r = analyze_candidate(candidate, typ, brand_data)
        db.add(models.Threat(
            company_id=company.id,
            candidate=candidate,
            asset_type=typ,
            platform="Synthetic demo",
            risk_score=r["risk_score"],
            risk_category=r["risk_category"],
            indicator_scores=r["indicator_scores"],
            reasons=r["reasons"],
            evidence=r["evidence"],
            discovery_method="synthetic demo seed",
            synthetic=True,
            status=status,
        ))
    db.add(models.Notification(
        company_id=company.id,
        title="Flask demo workspace ready",
        message="Sample candidates are synthetic and labeled. They were not discovered online.",
        kind="info",
    ))
    db.commit()
    db.refresh(user)
    return user, user.company


def request_context() -> tuple:
    """Return (db, user, company) for the current request.

    In DEMO_MODE we always return the auto-provisioned demo workspace. This
    lets the no-login Phase 1 frontend use the API transparently.
    """
    db = SessionLocal()
    try:
        if DEMO_MODE:
            user, company = ensure_demo_company(db)
            return db, user, company

        token = request.cookies.get(SESSION_COOKIE)
        if not token:
            db.close(); _error(401, "Please log in to continue.")
        record = db.scalar(
            select(models.SessionRecord).where(
                models.SessionRecord.token_hash == hash_token(token)
            )
        )
        if (not record
                or record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)):
            db.close(); _error(401, "Session expired. Please log in again.")
        user = db.get(models.User, record.user_id)
        if not user:
            db.close(); _error(401, "Session is no longer valid.")
        return db, user, user.company
    except Exception:
        db.close()
        raise


def owned_threat(db: Session, company_id: int, threat_id: int) -> models.Threat:
    item = db.scalar(
        select(models.Threat).where(
            models.Threat.id == threat_id,
            models.Threat.company_id == company_id,
        )
    )
    if not item:
        _error(404, "Threat not found.")
    return item


def owned_incident(db: Session, company_id: int, incident_id: int) -> models.Incident:
    item = db.scalar(
        select(models.Incident).where(
            models.Incident.id == incident_id,
            models.Incident.company_id == company_id,
        )
    )
    if not item:
        _error(404, "Incident not found.")
    return item


def add_notification(db: Session, company_id: int, title: str, message: str,
                     kind: str = "info") -> None:
    db.add(models.Notification(
        company_id=company_id, title=title, message=message, kind=kind,
    ))


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def serialize_company(c: models.Company) -> dict:
    return {
        "id": c.id, "name": c.name, "industry": c.industry,
        "website": c.website, "email": c.email, "description": c.description,
    }


def serialize_threat(t: models.Threat) -> dict:
    return {
        "id": t.id, "candidate": t.candidate, "asset_type": t.asset_type,
        "platform": t.platform, "risk_score": t.risk_score,
        "risk_category": t.risk_category,
        "indicator_scores": t.indicator_scores or {},
        "reasons": t.reasons or [], "evidence": t.evidence or [],
        "discovery_method": t.discovery_method, "status": t.status,
        "analyst_notes": t.analyst_notes, "synthetic": bool(t.synthetic),
        "first_seen": t.first_seen.isoformat() if t.first_seen else None,
        "last_checked": t.last_checked.isoformat() if t.last_checked else None,
    }


def serialize_incident(i: models.Incident) -> dict:
    return {
        "id": i.id, "threat_id": i.threat_id, "title": i.title,
        "description": i.description, "severity": i.severity,
        "status": i.status, "notes": i.notes or [],
        "resolution_notes": i.resolution_notes,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "updated_at": i.updated_at.isoformat() if i.updated_at else None,
    }


def serialize_notification(n: models.Notification) -> dict:
    return {
        "id": n.id, "title": n.title, "message": n.message,
        "kind": n.kind, "read": bool(n.read),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ---------------------------------------------------------------------------
# Generic JSON error handling (fallback)
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def _nf(err):
    msg = getattr(err, "description", None)
    if msg:
        return jsonify({"detail": msg}), 404
    return jsonify({"detail": "Not found."}), 404


@app.errorhandler(405)
def _method(err):
    return jsonify({"detail": "Method not allowed."}), 405


@app.errorhandler(413)
def _large(err):
    return jsonify({"detail": "Upload too large."}), 413


@app.errorhandler(500)
def _srv(err):
    return jsonify({"detail": "Internal server error."}), 500


# ===========================================================================
# API endpoints
# ===========================================================================

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "BrandShield AI",
        "mode": "manual-analysis-demo",
        "demo_mode": DEMO_MODE,
        "stack": "Flask + SQLAlchemy",
        "database_url_scheme": engine.url.drivername,
    })


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    if DEMO_MODE:
        return jsonify({
            "detail": "Register is disabled in demo mode. Use the pre-provisioned workspace.",
            "demo_mode": True,
        }), 403
    data = get_json_body()
    email = trim_str(data.get("email"), 254).lower()
    if not valid_email(email):
        _error(422, "Enter a valid email address.")
    password = trim_str(data.get("password"), 128)
    if len(password) < 8:
        _error(422, "Password must be at least 8 characters.")
    company_name = trim_str(data.get("company_name"), 160)
    if len(company_name) < 2:
        _error(422, "Company name too short.")
    with SessionLocal() as db:
        if db.scalar(select(models.User).where(func.lower(models.User.email) == email)):
            _error(409, "An account with this email already exists.")
        company = models.Company(
            name=company_name,
            industry=trim_str(data.get("industry"), 100) or "Other",
            website=trim_str(data.get("website"), 500),
            email=email,
            description=trim_str(data.get("description"), 3000),
        )
        db.add(company); db.flush()
        user = models.User(
            company_id=company.id, email=email,
            password_hash=hash_password(password), role="admin",
        )
        brand = models.BrandProfile(
            company_id=company.id,
            official_name=company.name,
            official_website=company.website,
            description=company.description,
        )
        db.add_all([user, brand]); db.flush()
        token, token_hash, expires = new_session()
        db.add(models.SessionRecord(
            token_hash=token_hash, user_id=user.id, expires_at=expires,
        ))
        db.commit()
        user_out = {"id": user.id, "email": user.email, "role": user.role}
        company_out = serialize_company(company)
    resp = jsonify({"user": user_out, "company": company_out})
    resp.set_cookie(
        SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE,
        samesite="Lax", max_age=SESSION_HOURS * 3600, path="/",
    )
    return resp, 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = get_json_body()
    db_ctx, user_ctx, company_ctx = request_context()
    try:
        if DEMO_MODE:
            token, token_hash, expires = new_session()
            db_ctx.add(models.SessionRecord(
                token_hash=token_hash, user_id=user_ctx.id, expires_at=expires,
            ))
            db_ctx.commit()
            resp = jsonify({
                "user": {
                    "id": user_ctx.id, "email": user_ctx.email,
                    "role": user_ctx.role,
                },
                "company": serialize_company(company_ctx),
                "demo_mode": True,
                "notice": "Running in BrandShield AI demo mode.",
            })
            resp.set_cookie(
                SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE,
                samesite="Lax", max_age=SESSION_HOURS * 3600, path="/",
            )
            return resp
    finally:
        db_ctx.close()

    email = trim_str(data.get("email"), 254).lower()
    password = trim_str(data.get("password"), 128)
    with SessionLocal() as db:
        user = db.scalar(select(models.User).where(func.lower(models.User.email) == email))
        if not user or not verify_password(password, user.password_hash):
            _error(401, "Email or password is incorrect.")
        token, token_hash, expires = new_session()
        db.add(models.SessionRecord(
            token_hash=token_hash, user_id=user.id, expires_at=expires,
        ))
        db.commit()
        company_out = serialize_company(user.company)
        user_out = {"id": user.id, "email": user.email, "role": user.role}
    resp = jsonify({"user": user_out, "company": company_out})
    resp.set_cookie(
        SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE,
        samesite="Lax", max_age=SESSION_HOURS * 3600, path="/",
    )
    return resp


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.cookies.get(SESSION_COOKIE)
    if not DEMO_MODE and token:
        with SessionLocal() as db:
            row = db.scalar(
                select(models.SessionRecord).where(
                    models.SessionRecord.token_hash == hash_token(token)
                )
            )
            if row:
                db.delete(row); db.commit()
    resp = jsonify({"ok": True})
    resp.delete_cookie(SESSION_COOKIE, path="/")
    return resp


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    db, user, company = request_context()
    try:
        return jsonify({
            "user": {"id": user.id, "email": user.email, "role": user.role},
            "company": serialize_company(company),
            "demo_mode": DEMO_MODE,
        })
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Company + brand profile
# ---------------------------------------------------------------------------

@app.route("/api/companies/me", methods=["GET"])
def company_me():
    db, user, company = request_context()
    try:
        return jsonify(serialize_company(company))
    finally:
        db.close()


@app.route("/api/companies/me", methods=["PATCH"])
def update_company():
    db, user, company = request_context()
    try:
        data = get_json_body()
        allowed = {"name", "industry", "website", "description"}
        for key, value in data.items():
            if key in allowed and isinstance(value, str):
                setattr(company, key, trim_str(value, 3000))
        db.commit(); db.refresh(company)
        return jsonify(serialize_company(company))
    finally:
        db.close()


@app.route("/api/companies/me/brand-profile", methods=["GET"])
def get_brand():
    db, user, company = request_context()
    try:
        brand = db.scalar(
            select(models.BrandProfile).where(
                models.BrandProfile.company_id == company.id
            )
        )
        if not brand:
            brand = models.BrandProfile(
                company_id=company.id,
                official_name=company.name,
                official_website=company.website,
            )
            db.add(brand); db.commit(); db.refresh(brand)
        fields = [
            "official_name", "alternative_names", "official_website",
            "official_domains", "social_accounts", "logo_path",
            "registration_urls", "payment_instructions", "description",
            "verification_status",
        ]
        return jsonify({k: getattr(brand, k) for k in fields})
    finally:
        db.close()


@app.route("/api/companies/me/brand-profile", methods=["PUT"])
def save_brand():
    db, user, company = request_context()
    try:
        data = get_json_body()
        official_website = trim_str(data.get("official_website"), 500)
        official_domains = data.get("official_domains") or []
        social_accounts = data.get("social_accounts") or []
        registration_urls = data.get("registration_urls") or []
        for url in [official_website, *official_domains, *social_accounts, *registration_urls]:
            if url and not re.match(r"^https?://", str(url).strip(), re.I):
                _error(422, "URLs must begin with http:// or https://")
        brand = db.scalar(
            select(models.BrandProfile).where(
                models.BrandProfile.company_id == company.id
            )
        )
        if not brand:
            brand = models.BrandProfile(company_id=company.id)
            db.add(brand)
        brand.official_name = trim_str(data.get("official_name"), 160) or company.name
        alt = data.get("alternative_names")
        brand.alternative_names = [
            trim_str(x, 160) for x in (alt if isinstance(alt, list) else [])[:30]
        ]
        brand.official_website = official_website
        brand.official_domains = [
            trim_str(x, 500) for x in official_domains if isinstance(x, str)
        ][:30]
        brand.social_accounts = [
            trim_str(x, 500) for x in social_accounts if isinstance(x, str)
        ][:50]
        brand.registration_urls = [
            trim_str(x, 500) for x in registration_urls if isinstance(x, str)
        ][:30]
        brand.payment_instructions = trim_str(data.get("payment_instructions"), 2000)
        brand.description = trim_str(data.get("description"), 3000)
        vs = trim_str(data.get("verification_status"), 40)
        brand.verification_status = vs if vs in {"unverified", "pending", "verified"} else "unverified"
        company.name = brand.official_name
        db.commit(); db.refresh(brand)
        fields = [
            "official_name", "alternative_names", "official_website",
            "official_domains", "social_accounts", "logo_path",
            "registration_urls", "payment_instructions", "description",
            "verification_status",
        ]
        return jsonify({k: getattr(brand, k) for k in fields})
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Scans + threats
# ---------------------------------------------------------------------------

def _run_analysis(db: Session, company_id: int, candidate: str, asset_type: str,
                 platform: str) -> tuple:
    brand = db.scalar(
        select(models.BrandProfile).where(
            models.BrandProfile.company_id == company_id
        )
    )
    brand_data = {
        "official_name": brand.official_name if brand else "",
        "alternative_names": brand.alternative_names if brand else [],
        "official_website": brand.official_website if brand else "",
        "official_domains": brand.official_domains if brand else [],
        "verification_status": brand.verification_status if brand else "unverified",
    }
    result = analyze_candidate(candidate, asset_type, brand_data)
    threat = db.scalar(
        select(models.Threat).where(
            models.Threat.company_id == company_id,
            models.Threat.candidate == candidate,
        )
    )
    created = threat is None
    if not threat:
        threat = models.Threat(company_id=company_id, candidate=candidate)
        db.add(threat)
    threat.asset_type = asset_type
    threat.platform = platform
    threat.risk_score = result["risk_score"]
    threat.risk_category = result["risk_category"]
    threat.indicator_scores = result["indicator_scores"]
    threat.reasons = result["reasons"]
    threat.evidence = result["evidence"] + [
        {"type": "limitations", "value": x} for x in result["limitations"]
    ]
    threat.discovery_method = "manual candidate submission"
    threat.last_checked = datetime.now(timezone.utc)
    run = models.ScanRun(
        company_id=company_id,
        status="completed",
        source="manual candidate submission",
        candidates_checked=1,
        findings_created=1 if created else 0,
    )
    db.add(run)
    if created and threat.risk_score >= 60:
        add_notification(
            db, company_id,
            "High-risk candidate analyzed",
            f"{candidate} received a preliminary score of {threat.risk_score}.",
            "warning",
        )
    db.commit(); db.refresh(threat)
    return threat, result, run, created


@app.route("/api/scans", methods=["POST"])
def create_scan():
    data = get_json_body()
    candidate = trim_str(data.get("candidate"), 700)
    if len(candidate) < 3:
        _error(422, "Candidate too short.")
    if "\x00" in candidate:
        _error(422, "Candidate contains invalid characters.")
    asset_type = trim_str(data.get("asset_type"), 40) or "website"
    platform = trim_str(data.get("platform"), 80) or "Manual submission"
    db, user, company = request_context()
    try:
        threat, result, run, created = _run_analysis(
            db, company.id, candidate, asset_type, platform,
        )
        return jsonify({
            "threat": serialize_threat(threat),
            "analysis": result,
            "scan": {
                "id": run.id, "status": run.status, "source": run.source,
                "candidates_checked": run.candidates_checked,
                "findings_created": run.findings_created,
                "created_at": run.created_at.isoformat() if run.created_at else None,
            },
            "created": created,
            "mode": "rule-based manual analysis; no external platform queried",
        }), 201
    finally:
        db.close()


@app.route("/api/scans", methods=["GET"])
def list_scans():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.ScanRun).where(
                models.ScanRun.company_id == company.id
            ).order_by(desc(models.ScanRun.created_at)).limit(100)
        ).all()
        return jsonify([{
            "id": r.id, "status": r.status, "source": r.source,
            "candidates_checked": r.candidates_checked,
            "findings_created": r.findings_created,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows])
    finally:
        db.close()


@app.route("/api/scans/<int:scan_id>", methods=["GET"])
def get_scan(scan_id: int):
    db, user, company = request_context()
    try:
        r = db.scalar(
            select(models.ScanRun).where(
                models.ScanRun.id == scan_id,
                models.ScanRun.company_id == company.id,
            )
        )
        if not r:
            _error(404, "Scan not found.")
        return jsonify({
            "id": r.id, "status": r.status, "source": r.source,
            "candidates_checked": r.candidates_checked,
            "findings_created": r.findings_created,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    finally:
        db.close()


@app.route("/api/threats", methods=["GET"])
def list_threats():
    db, user, company = request_context()
    try:
        q = trim_str(request.args.get("q", ""), 200)
        risk = trim_str(request.args.get("risk", ""), 20)
        status = trim_str(request.args.get("status", ""), 40)
        asset_type = trim_str(request.args.get("asset_type", ""), 40)
        page = max(1, int(request.args.get("page", 1) or 1))
        page_size = min(100, max(1, int(request.args.get("page_size", 20) or 20)))
        stmt = select(models.Threat).where(models.Threat.company_id == company.id)
        if q:
            stmt = stmt.where(models.Threat.candidate.ilike(f"%{q}%"))
        if risk:
            stmt = stmt.where(models.Threat.risk_category == risk)
        if status:
            stmt = stmt.where(models.Threat.status == status)
        if asset_type:
            stmt = stmt.where(models.Threat.asset_type == asset_type)
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = db.scalars(
            stmt.order_by(desc(models.Threat.last_checked))
            .offset((page - 1) * page_size).limit(page_size)
        ).all()
        return jsonify({
            "items": [serialize_threat(t) for t in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        })
    finally:
        db.close()


@app.route("/api/threats/<int:threat_id>", methods=["GET"])
def get_threat(threat_id: int):
    db, user, company = request_context()
    try:
        return jsonify(serialize_threat(owned_threat(db, company.id, threat_id)))
    finally:
        db.close()


@app.route("/api/threats", methods=["POST"])
def create_threat():
    data = get_json_body()
    candidate = trim_str(data.get("candidate"), 700)
    if len(candidate) < 3:
        _error(422, "Candidate too short.")
    asset_type = trim_str(data.get("asset_type"), 40) or "website"
    platform = trim_str(data.get("platform"), 80) or "Manual submission"
    db, user, company = request_context()
    try:
        threat, _result, _run, _created = _run_analysis(
            db, company.id, candidate, asset_type, platform,
        )
        return jsonify(serialize_threat(threat)), 201
    finally:
        db.close()


@app.route("/api/threats/<int:threat_id>", methods=["PATCH"])
def patch_threat(threat_id: int):
    data = get_json_body()
    db, user, company = request_context()
    try:
        threat = owned_threat(db, company.id, threat_id)
        if "status" in data and data.get("status") is not None:
            status_val = data["status"]
            if status_val not in VALID_THREAT_STATUS:
                _error(422, "Unsupported investigation status.")
            threat.status = status_val
            add_notification(
                db, company.id, "Threat status updated",
                f"{threat.candidate} is now {threat.status}.",
            )
        if "analyst_notes" in data and data.get("analyst_notes") is not None:
            threat.analyst_notes = trim_str(data["analyst_notes"], 5000)
        db.commit(); db.refresh(threat)
        return jsonify(serialize_threat(threat))
    finally:
        db.close()


@app.route("/api/threats/<int:threat_id>/notes", methods=["POST"])
def add_threat_note(threat_id: int):
    data = get_json_body()
    note_text = trim_str(data.get("note"), 5000)
    if not note_text:
        _error(422, "Note text is required.")
    db, user, company = request_context()
    try:
        threat = owned_threat(db, company.id, threat_id)
        note = models.ThreatNote(
            company_id=company.id, threat_id=threat.id,
            user_id=user.id, note=note_text,
        )
        db.add(note); db.commit(); db.refresh(note)
        return jsonify({
            "id": note.id, "note": note.note,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "user_email": user.email,
        }), 201
    finally:
        db.close()


@app.route("/api/threats/<int:threat_id>/notes", methods=["GET"])
def list_threat_notes(threat_id: int):
    db, user, company = request_context()
    try:
        owned_threat(db, company.id, threat_id)
        rows = db.scalars(
            select(models.ThreatNote).where(
                models.ThreatNote.company_id == company.id,
                models.ThreatNote.threat_id == threat_id,
            ).order_by(models.ThreatNote.created_at)
        ).all()

        def email_for(uid):
            u = db.get(models.User, uid)
            return u.email if u else "Former user"

        return jsonify([{
            "id": n.id, "note": n.note,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "user_email": email_for(n.user_id),
        } for n in rows])
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Incidents (investigations)
# ---------------------------------------------------------------------------

@app.route("/api/incidents", methods=["GET"])
def list_incidents():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.Incident).where(
                models.Incident.company_id == company.id
            ).order_by(desc(models.Incident.updated_at))
        ).all()
        return jsonify([serialize_incident(i) for i in rows])
    finally:
        db.close()


@app.route("/api/incidents", methods=["POST"])
def create_incident():
    data = get_json_body()
    title = trim_str(data.get("title"), 200)
    if len(title) < 3:
        _error(422, "Incident title too short.")
    severity = trim_str(data.get("severity"), 20) or "Medium"
    if severity not in VALID_SEVERITY:
        _error(422, "Unsupported severity.")
    threat_id = data.get("threat_id")
    threat_id_int = None
    db, user, company = request_context()
    try:
        if threat_id is not None:
            try:
                threat_id_int = int(threat_id)
            except (TypeError, ValueError):
                _error(422, "Invalid threat_id.")
            owned_threat(db, company.id, threat_id_int)
        incident = models.Incident(
            company_id=company.id,
            threat_id=threat_id_int,
            title=title,
            description=trim_str(data.get("description"), 5000),
            severity=severity,
        )
        db.add(incident); db.flush()
        add_notification(db, company.id, "Incident created", title, "warning")
        db.commit(); db.refresh(incident)
        return jsonify(serialize_incident(incident)), 201
    finally:
        db.close()


@app.route("/api/incidents/<int:incident_id>", methods=["GET"])
def get_incident(incident_id: int):
    db, user, company = request_context()
    try:
        return jsonify(serialize_incident(owned_incident(db, company.id, incident_id)))
    finally:
        db.close()


@app.route("/api/incidents/<int:incident_id>", methods=["PATCH"])
def patch_incident(incident_id: int):
    data = get_json_body()
    db, user, company = request_context()
    try:
        incident = owned_incident(db, company.id, incident_id)
        if "status" in data and data.get("status") is not None:
            status_val = data["status"]
            if status_val not in VALID_INCIDENT_STATUS:
                _error(422, "Unsupported incident status.")
            incident.status = status_val
        if "resolution_notes" in data and data.get("resolution_notes") is not None:
            incident.resolution_notes = trim_str(data["resolution_notes"], 5000)
        note_val = trim_str(data.get("note"), 5000) if "note" in data else None
        if note_val:
            notes = list(incident.notes or [])
            notes.append({
                "note": note_val,
                "at": datetime.now(timezone.utc).isoformat(),
                "by": user.email,
            })
            incident.notes = notes
        db.commit(); db.refresh(incident)
        add_notification(db, company.id, "Incident updated", incident.title)
        db.commit()
        return jsonify(serialize_incident(incident))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@app.route("/api/notifications", methods=["GET"])
def list_notifications():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.Notification).where(
                models.Notification.company_id == company.id
            ).order_by(desc(models.Notification.created_at)).limit(100)
        ).all()
        return jsonify([serialize_notification(n) for n in rows])
    finally:
        db.close()


@app.route("/api/notifications/<int:notification_id>", methods=["PATCH"])
def update_notification(notification_id: int):
    data = get_json_body()
    db, user, company = request_context()
    try:
        n = db.scalar(
            select(models.Notification).where(
                models.Notification.id == notification_id,
                models.Notification.company_id == company.id,
            )
        )
        if not n:
            _error(404, "Notification not found.")
        n.read = bool(data.get("read", True))
        db.commit()
        return jsonify(serialize_notification(n))
    finally:
        db.close()


@app.route("/api/notifications/mark-all-read", methods=["POST"])
def mark_all_read():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.Notification).where(
                models.Notification.company_id == company.id,
                models.Notification.read == False,
            )
        ).all()
        for n in rows:
            n.read = True
        db.commit()
        return jsonify({"updated": len(rows)})
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.route("/api/dashboard/summary", methods=["GET"])
def dashboard_summary():
    db, user, company = request_context()
    try:
        threats = db.scalars(
            select(models.Threat).where(models.Threat.company_id == company.id)
        ).all()
        incidents = db.scalars(
            select(models.Incident).where(models.Incident.company_id == company.id)
        ).all()
        notifications = db.scalars(
            select(models.Notification).where(
                models.Notification.company_id == company.id,
                models.Notification.read == False,
            )
        ).all()
        scans = db.scalars(
            select(models.ScanRun).where(
                models.ScanRun.company_id == company.id
            ).order_by(desc(models.ScanRun.created_at)).limit(1)
        ).first()
        risk_dist = {k: sum(t.risk_category == k for t in threats)
                     for k in ["Low", "Medium", "High", "Critical"]}
        platform_keys = sorted({t.asset_type for t in threats})
        platform_dist = {k: sum(t.asset_type == k for t in threats) for k in platform_keys}
        recent = sorted(
            threats,
            key=lambda t: t.last_checked.timestamp() if t.last_checked else 0,
            reverse=True,
        )[:6]
        return jsonify({
            "total_assets": len(threats),
            "high_risk": sum(t.risk_score >= 60 for t in threats),
            "open_investigations": sum(t.status not in {"Resolved", "Closed"} for t in threats),
            "resolved_incidents": sum(i.status == "Resolved" for i in incidents),
            "unread_notifications": len(notifications),
            "risk_distribution": risk_dist,
            "platform_distribution": platform_dist,
            "recent_threats": [serialize_threat(t) for t in recent],
            "last_scan": ({
                "id": scans.id, "status": scans.status,
                "created_at": scans.created_at.isoformat() if scans.created_at else None,
                "source": scans.source,
            } if scans else None),
            "demo_notice": (
                "Manual rule-based analysis only. Synthetic examples are labeled; "
                "external platforms are not scanned."
            ),
        })
    finally:
        db.close()


@app.route("/api/dashboard/charts", methods=["GET"])
def dashboard_charts():
    db, user, company = request_context()
    try:
        threats = db.scalars(
            select(models.Threat).where(models.Threat.company_id == company.id)
        ).all()
        daily: dict = {}
        for t in threats:
            day = t.first_seen.date().isoformat() if t.first_seen else "Unknown"
            daily[day] = daily.get(day, 0) + 1
        items = sorted(daily.items())[-14:]
        findings_over_time = [{"date": k, "count": v} for k, v in items]
        risk_dist = {k: sum(t.risk_category == k for t in threats)
                     for k in ["Low", "Medium", "High", "Critical"]}
        platform_keys = sorted({t.asset_type for t in threats})
        platform_dist = {k: sum(t.asset_type == k for t in threats) for k in platform_keys}
        return jsonify({
            "findings_over_time": findings_over_time,
            "risk_distribution": risk_dist,
            "platform_distribution": platform_dist,
        })
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Reports (CSV export)
# ---------------------------------------------------------------------------

def _csv_response(row_gen, header, filename):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in row_gen:
        writer.writerow(row)
    data = buf.getvalue().encode("utf-8-sig")
    return Response(
        data,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Length": str(len(data)),
        },
    )


@app.route("/api/reports/incidents.csv", methods=["GET"])
def export_incidents():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.Incident).where(
                models.Incident.company_id == company.id
            ).order_by(models.Incident.id)
        ).all()

        def gen():
            for i in rows:
                yield [
                    i.id, i.threat_id, i.title, i.severity, i.status,
                    i.description, i.resolution_notes,
                    i.created_at.isoformat() if i.created_at else "",
                ]
        return _csv_response(
            gen(),
            ["incident_id", "threat_id", "title", "severity", "status",
             "description", "resolution_notes", "created_at"],
            "brandshield-incidents.csv",
        )
    finally:
        db.close()


@app.route("/api/reports/threats.csv", methods=["GET"])
def export_threats():
    db, user, company = request_context()
    try:
        rows = db.scalars(
            select(models.Threat).where(
                models.Threat.company_id == company.id
            ).order_by(models.Threat.id)
        ).all()

        def gen():
            for t in rows:
                yield [
                    t.id, t.candidate, t.asset_type, t.risk_score,
                    t.risk_category, t.status, bool(t.synthetic),
                    " | ".join(t.reasons or []),
                ]
        return _csv_response(
            gen(),
            ["threat_id", "candidate", "asset_type", "risk_score",
             "risk_category", "status", "synthetic", "reasons"],
            "brandshield-threats.csv",
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Demo seed
# ---------------------------------------------------------------------------

@app.route("/api/demo/seed", methods=["POST"])
def seed_demo():
    db, user, company = request_context()
    try:
        brand = db.scalar(
            select(models.BrandProfile).where(
                models.BrandProfile.company_id == company.id
            )
        )
        if not brand:
            brand = models.BrandProfile(
                company_id=company.id,
                official_name=company.name,
                official_website=company.website,
            )
            db.add(brand); db.commit(); db.refresh(brand)
        if not brand.official_name:
            brand.official_name = "BrandShield Demo"
        if not brand.official_domains:
            brand.official_domains = ["brandshield.example"]
        examples = [
            ("brandshiled-help.example", "website"),
            ("brandshield-prizes.example", "website"),
            ("@brandshield_bonus", "social profile"),
            ("@brandshield_verify", "social profile"),
        ]
        brand_data = {
            "official_name": brand.official_name,
            "alternative_names": list(brand.alternative_names or []),
            "official_website": brand.official_website,
            "official_domains": list(brand.official_domains or ["brandshield.example"]),
            "verification_status": brand.verification_status,
        }
        added = 0
        for candidate, typ in examples:
            if db.scalar(
                select(models.Threat).where(
                    models.Threat.company_id == company.id,
                    models.Threat.candidate == candidate,
                )
            ):
                continue
            result = analyze_candidate(candidate, typ, brand_data)
            db.add(models.Threat(
                company_id=company.id, candidate=candidate, asset_type=typ,
                platform="Synthetic demo",
                risk_score=result["risk_score"],
                risk_category=result["risk_category"],
                indicator_scores=result["indicator_scores"],
                reasons=result["reasons"], evidence=result["evidence"],
                discovery_method="synthetic demo seed",
                synthetic=True, status="New",
            ))
            added += 1
        if added:
            add_notification(
                db, company.id,
                "Synthetic demo data added",
                f"Added {added} fictional sample assets. These are not real discovered threats.",
            )
            db.commit()
        return jsonify({
            "added": added,
            "synthetic": True,
            "message": "All seeded assets are fictional demonstration records.",
        })
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Evidence upload
# ---------------------------------------------------------------------------

ALLOWED_UPLOAD_MIME = {
    "image/png", "image/jpeg", "image/webp", "text/plain", "application/pdf",
}
UPLOAD_MAGIC = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "image/webp": b"RIFF",
    "application/pdf": b"%PDF",
}


@app.route("/api/evidence", methods=["POST"])
def upload_evidence():
    threat_id_raw = request.args.get("threat_id") or request.form.get("threat_id")
    try:
        threat_id = int(threat_id_raw or 0)
    except (TypeError, ValueError):
        _error(422, "threat_id is required.")
    file = request.files.get("file")
    if not file or not file.filename:
        _error(400, "A file is required.")
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_UPLOAD_MIME:
        _error(415, "Only PNG, JPEG, WebP, plain text, or PDF evidence is accepted.")
    data = file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        _error(413, "Evidence file must be 5 MB or smaller.")
    if mime in UPLOAD_MAGIC and not data.startswith(UPLOAD_MAGIC[mime]):
        _error(415, "File content does not match its declared type.")
    if mime == "image/webp" and data[8:12] != b"WEBP":
        _error(415, "Invalid WebP file.")
    ext = {
        "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
        "text/plain": ".txt", "application/pdf": ".pdf",
    }[mime]
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    stored = secrets.token_hex(20) + ext
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
        f.write(data)
    db, user, company = request_context()
    try:
        threat = owned_threat(db, company.id, threat_id)
        ev = list(threat.evidence or [])
        ev.append({
            "type": "uploaded_evidence",
            "file_id": stored,
            "filename": Path(file.filename or "evidence").name[:150],
            "content_type": mime,
            "size": len(data),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })
        threat.evidence = ev
        db.commit()
        return jsonify({
            "ok": True,
            "filename": Path(file.filename or "evidence").name,
            "size": len(data),
            "download_url": f"/api/evidence/{stored}/download",
        }), 201
    finally:
        db.close()


@app.route("/api/evidence/<file_id>/download", methods=["GET"])
def download_evidence(file_id: str):
    if not re.fullmatch(r"[a-f0-9]{40}\.(png|jpg|webp|txt|pdf)", file_id or ""):
        _error(404, "Evidence not found.")
    db, user, company = request_context()
    try:
        threats = db.scalars(
            select(models.Threat).where(models.Threat.company_id == company.id)
        ).all()
    finally:
        db.close()
    match = None
    for t in threats:
        for e in (t.evidence or []):
            if e.get("file_id") == file_id:
                match = e
                break
        if match:
            break
    path = os.path.join(UPLOAD_DIR, file_id)
    if not match or not os.path.isfile(path):
        _error(404, "Evidence not found.")
    return send_file(
        path,
        as_attachment=True,
        download_name=match.get("filename", "evidence"),
        mimetype=match.get("content_type", "application/octet-stream"),
    )


# ===========================================================================
# Static frontend serving (keep last so /api/* routes win)
# ===========================================================================

FRONTEND_PATH = Path(FRONTEND_DIR)


@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve_frontend(path: str):
    """Serve Phase 1 static frontend; unknown paths send index.html."""
    if path.startswith("api/") or path == "api":
        _error(404, "Unknown API route.")
    target_file = FRONTEND_PATH / path if path else FRONTEND_PATH / "index.html"
    if path and target_file.is_file():
        return send_from_directory(str(FRONTEND_PATH), path)
    if path and (FRONTEND_PATH / path).is_dir():
        sub = FRONTEND_PATH / path / "index.html"
        if sub.is_file():
            return send_file(str(sub))
    fallback = FRONTEND_PATH / "index.html"
    if not fallback.is_file():
        _error(404, "Frontend not found.")
    return send_file(str(fallback))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_dev_server(host: str = "127.0.0.1", port: int = 5000) -> None:
    """Run the Flask dev server for local Phase 2 testing."""
    print("BrandShield AI Flask backend starting...")
    print(f"  Frontend:  http://{host}:{port}/")
    print(f"  API health: http://{host}:{port}/api/health")
    print(f"  Demo mode:  {DEMO_MODE} (workspace auto-provisioned)")
    print("  Analysis is rule-based only. No live internet scanning.")
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    run_dev_server(port=port)
