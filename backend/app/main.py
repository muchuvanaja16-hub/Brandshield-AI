from datetime import datetime, timezone
from pathlib import Path
import csv, io, re, os
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc
from .database import Base, engine, get_db, SessionLocal
from . import models, schemas
from .config import SESSION_COOKIE, COOKIE_SECURE, SESSION_HOURS, FRONTEND_DIR, UPLOAD_DIR
from .security import hash_password, verify_password, new_session, hash_token
from .services.risk_scoring import analyze_candidate, extract_host

Base.metadata.create_all(bind=engine)
app = FastAPI(title="BrandShield AI API", version="1.0.0", description="Company-facing digital risk protection MVP. Analysis is rule-based; external discovery is not enabled.")

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    return response

def valid_email(email: str) -> bool:
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email or ""))

def serialize_company(c):
    return {"id": c.id, "name": c.name, "industry": c.industry, "website": c.website, "email": c.email, "description": c.description}

def serialize_threat(t):
    return {"id": t.id, "candidate": t.candidate, "asset_type": t.asset_type, "platform": t.platform, "risk_score": t.risk_score, "risk_category": t.risk_category, "indicator_scores": t.indicator_scores or {}, "reasons": t.reasons or [], "evidence": t.evidence or [], "discovery_method": t.discovery_method, "status": t.status, "analyst_notes": t.analyst_notes, "synthetic": t.synthetic, "first_seen": t.first_seen.isoformat() if t.first_seen else None, "last_checked": t.last_checked.isoformat() if t.last_checked else None}

def serialize_incident(i):
    return {"id": i.id, "threat_id": i.threat_id, "title": i.title, "description": i.description, "severity": i.severity, "status": i.status, "notes": i.notes or [], "resolution_notes": i.resolution_notes, "created_at": i.created_at.isoformat() if i.created_at else None, "updated_at": i.updated_at.isoformat() if i.updated_at else None}

def serialize_notification(n):
    return {"id": n.id, "title": n.title, "message": n.message, "kind": n.kind, "read": n.read, "created_at": n.created_at.isoformat() if n.created_at else None}

def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if not token: raise HTTPException(401, "Please log in to continue.")
    record = db.scalar(select(models.SessionRecord).where(models.SessionRecord.token_hash == hash_token(token)))
    if not record or record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired. Please log in again.")
    user = db.get(models.User, record.user_id)
    if not user: raise HTTPException(401, "Session is no longer valid.")
    return user

def owned_threat(db, user, threat_id):
    item = db.scalar(select(models.Threat).where(models.Threat.id == threat_id, models.Threat.company_id == user.company_id))
    if not item: raise HTTPException(404, "Threat not found.")
    return item

def owned_incident(db, user, incident_id):
    item = db.scalar(select(models.Incident).where(models.Incident.id == incident_id, models.Incident.company_id == user.company_id))
    if not item: raise HTTPException(404, "Incident not found.")
    return item

def add_notification(db, company_id, title, message, kind="info"):
    db.add(models.Notification(company_id=company_id, title=title, message=message, kind=kind))

@app.get("/api/health")
def health(): return {"status": "ok", "service": "BrandShield AI", "mode": "manual-analysis-demo"}

@app.post("/api/auth/register", status_code=201)
def register(payload: schemas.RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not valid_email(email): raise HTTPException(422, "Enter a valid email address.")
    if db.scalar(select(models.User).where(func.lower(models.User.email) == email)): raise HTTPException(409, "An account with this email already exists.")
    company = models.Company(name=payload.company_name.strip(), industry=payload.industry.strip() or "Other", website=payload.website.strip(), email=email, description=payload.description.strip())
    db.add(company); db.flush()
    user = models.User(company_id=company.id, email=email, password_hash=hash_password(payload.password), role="admin")
    brand = models.BrandProfile(company_id=company.id, official_name=company.name, official_website=company.website, description=company.description)
    db.add_all([user, brand]); db.flush()
    token, token_hash, expires = new_session(); db.add(models.SessionRecord(token_hash=token_hash, user_id=user.id, expires_at=expires)); db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_HOURS*3600, path="/")
    return {"user": {"id": user.id, "email": user.email, "role": user.role}, "company": serialize_company(company)}

@app.post("/api/auth/login")
def login(payload: schemas.LoginIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(models.User).where(func.lower(models.User.email) == email))
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(401, "Email or password is incorrect.")
    token, token_hash, expires = new_session(); db.add(models.SessionRecord(token_hash=token_hash, user_id=user.id, expires_at=expires)); db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_HOURS*3600, path="/")
    return {"user": {"id": user.id, "email": user.email, "role": user.role}, "company": serialize_company(user.company)}

@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        row = db.scalar(select(models.SessionRecord).where(models.SessionRecord.token_hash == hash_token(token)))
        if row: db.delete(row); db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"user": {"id": user.id, "email": user.email, "role": user.role}, "company": serialize_company(user.company)}

@app.get("/api/companies/me")
def company_me(user=Depends(current_user)):
    return serialize_company(user.company)

@app.patch("/api/companies/me")
def update_company(payload: dict, user=Depends(current_user), db: Session = Depends(get_db)):
    allowed = {"name", "industry", "website", "description"}
    for key, value in payload.items():
        if key in allowed and isinstance(value, str): setattr(user.company, key, value[:3000])
    db.commit(); db.refresh(user.company)
    return serialize_company(user.company)

@app.get("/api/companies/me/brand-profile")
def get_brand(user=Depends(current_user), db: Session = Depends(get_db)):
    brand = db.scalar(select(models.BrandProfile).where(models.BrandProfile.company_id == user.company_id))
    if not brand:
        brand = models.BrandProfile(company_id=user.company_id, official_name=user.company.name, official_website=user.company.website); db.add(brand); db.commit(); db.refresh(brand)
    return {k: getattr(brand, k) for k in ["official_name","alternative_names","official_website","official_domains","social_accounts","logo_path","registration_urls","payment_instructions","description","verification_status"]}

@app.put("/api/companies/me/brand-profile")
def save_brand(payload: schemas.BrandIn, user=Depends(current_user), db: Session = Depends(get_db)):
    for url in [payload.official_website, *payload.official_domains, *payload.social_accounts, *payload.registration_urls]:
        if url and not re.match(r"^https?://", url.strip(), re.I): raise HTTPException(422, "URLs must begin with http:// or https://")
    brand = db.scalar(select(models.BrandProfile).where(models.BrandProfile.company_id == user.company_id))
    if not brand: brand = models.BrandProfile(company_id=user.company_id); db.add(brand)
    for key in ["official_name","alternative_names","official_website","official_domains","social_accounts","registration_urls","payment_instructions","description"]: setattr(brand, key, getattr(payload, key))
    brand.verification_status = payload.verification_status if payload.verification_status in {"unverified","pending","verified"} else "unverified"
    user.company.name = payload.official_name
    db.commit(); db.refresh(brand)
    return {k: getattr(brand, k) for k in ["official_name","alternative_names","official_website","official_domains","social_accounts","logo_path","registration_urls","payment_instructions","description","verification_status"]}

@app.post("/api/scans", status_code=201)
def create_scan(payload: schemas.ThreatIn, user=Depends(current_user), db: Session = Depends(get_db)):
    candidate = payload.candidate.strip()
    if "\x00" in candidate: raise HTTPException(422, "Candidate contains invalid characters.")
    brand = db.scalar(select(models.BrandProfile).where(models.BrandProfile.company_id == user.company_id))
    brand_data = {"official_name": brand.official_name if brand else user.company.name, "alternative_names": brand.alternative_names if brand else [], "official_website": brand.official_website if brand else user.company.website, "official_domains": brand.official_domains if brand else [], "verification_status": brand.verification_status if brand else "unverified"}
    result = analyze_candidate(candidate, payload.asset_type, brand_data)
    threat = db.scalar(select(models.Threat).where(models.Threat.company_id == user.company_id, models.Threat.candidate == candidate))
    created = threat is None
    if not threat: threat = models.Threat(company_id=user.company_id, candidate=candidate); db.add(threat)
    threat.asset_type = payload.asset_type; threat.platform = payload.platform; threat.risk_score = result["risk_score"]; threat.risk_category = result["risk_category"]
    threat.indicator_scores = result["indicator_scores"]; threat.reasons = result["reasons"]; threat.evidence = result["evidence"] + [{"type":"limitations","value": x} for x in result["limitations"]]
    threat.discovery_method = "manual candidate submission"; threat.last_checked = datetime.now(timezone.utc)
    if created and threat.risk_score >= 60: add_notification(db, user.company_id, "High-risk candidate analyzed", f"{candidate} received a preliminary score of {threat.risk_score}.", "warning")
    run = models.ScanRun(company_id=user.company_id, status="completed", source="manual candidate submission", candidates_checked=1, findings_created=1 if created else 0)
    db.add(run); db.commit(); db.refresh(threat)
    return {"threat": serialize_threat(threat), "analysis": result, "scan": {"id": run.id, "status": run.status, "source": run.source}, "created": created, "mode": "rule-based manual analysis; no external platform queried"}

@app.get("/api/scans")
def list_scans(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.ScanRun).where(models.ScanRun.company_id == user.company_id).order_by(desc(models.ScanRun.created_at)).limit(100)).all()
    return [{"id": r.id, "status": r.status, "source": r.source, "candidates_checked": r.candidates_checked, "findings_created": r.findings_created, "created_at": r.created_at.isoformat()} for r in rows]

@app.get("/api/scans/{scan_id}")
def get_scan(scan_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    r = db.scalar(select(models.ScanRun).where(models.ScanRun.id == scan_id, models.ScanRun.company_id == user.company_id))
    if not r: raise HTTPException(404, "Scan not found.")
    return {"id": r.id, "status": r.status, "source": r.source, "candidates_checked": r.candidates_checked, "findings_created": r.findings_created, "created_at": r.created_at.isoformat()}

@app.get("/api/threats")
def list_threats(q: str = "", risk: str = "", status: str = "", asset_type: str = "", page: int = 1, page_size: int = 20, user=Depends(current_user), db: Session = Depends(get_db)):
    page = max(1, page); page_size = min(100, max(1, page_size))
    stmt = select(models.Threat).where(models.Threat.company_id == user.company_id)
    if q: stmt = stmt.where(models.Threat.candidate.ilike(f"%{q[:200]}%"))
    if risk: stmt = stmt.where(models.Threat.risk_category == risk)
    if status: stmt = stmt.where(models.Threat.status == status)
    if asset_type: stmt = stmt.where(models.Threat.asset_type == asset_type)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(desc(models.Threat.last_checked)).offset((page-1)*page_size).limit(page_size)).all()
    return {"items": [serialize_threat(t) for t in rows], "total": total, "page": page, "page_size": page_size}

@app.get("/api/threats/{threat_id}")
def get_threat(threat_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    return serialize_threat(owned_threat(db, user, threat_id))

@app.post("/api/threats", status_code=201)
def create_threat(payload: schemas.ThreatIn, user=Depends(current_user), db: Session = Depends(get_db)):
    return create_scan(payload, user, db)["threat"]

@app.patch("/api/threats/{threat_id}")
def patch_threat(threat_id: int, payload: schemas.ThreatPatch, user=Depends(current_user), db: Session = Depends(get_db)):
    threat = owned_threat(db, user, threat_id)
    valid_status = {"New", "Under Investigation", "Awaiting Review", "Report Prepared", "Resolved", "Closed"}
    if payload.status is not None:
        if payload.status not in valid_status: raise HTTPException(422, "Unsupported investigation status.")
        threat.status = payload.status
        add_notification(db, user.company_id, "Threat status updated", f"{threat.candidate} is now {threat.status}.")
    if payload.analyst_notes is not None: threat.analyst_notes = payload.analyst_notes
    db.commit(); db.refresh(threat); return serialize_threat(threat)

@app.post("/api/threats/{threat_id}/notes", status_code=201)
def add_threat_note(threat_id: int, payload: schemas.NoteIn, user=Depends(current_user), db: Session = Depends(get_db)):
    threat = owned_threat(db, user, threat_id)
    note = models.ThreatNote(company_id=user.company_id, threat_id=threat.id, user_id=user.id, note=payload.note)
    db.add(note); db.commit(); db.refresh(note)
    return {"id": note.id, "note": note.note, "created_at": note.created_at.isoformat(), "user_email": user.email}

@app.get("/api/threats/{threat_id}/notes")
def list_threat_notes(threat_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    owned_threat(db, user, threat_id)
    rows = db.scalars(select(models.ThreatNote).where(models.ThreatNote.company_id == user.company_id, models.ThreatNote.threat_id == threat_id).order_by(models.ThreatNote.created_at)).all()
    return [{"id": n.id, "note": n.note, "created_at": n.created_at.isoformat(), "user_email": db.get(models.User,n.user_id).email if db.get(models.User,n.user_id) else "Former user"} for n in rows]

@app.get("/api/incidents")
def list_incidents(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Incident).where(models.Incident.company_id == user.company_id).order_by(desc(models.Incident.updated_at))).all()
    return [serialize_incident(i) for i in rows]

@app.post("/api/incidents", status_code=201)
def create_incident(payload: schemas.IncidentIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if payload.threat_id is not None: owned_threat(db, user, payload.threat_id)
    if payload.severity not in {"Low","Medium","High","Critical"}: raise HTTPException(422, "Unsupported severity.")
    incident = models.Incident(company_id=user.company_id, threat_id=payload.threat_id, title=payload.title, description=payload.description, severity=payload.severity)
    db.add(incident); db.flush(); add_notification(db, user.company_id, "Incident created", incident.title, "warning"); db.commit(); db.refresh(incident)
    return serialize_incident(incident)

@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    return serialize_incident(owned_incident(db, user, incident_id))

@app.patch("/api/incidents/{incident_id}")
def patch_incident(incident_id: int, payload: schemas.IncidentPatch, user=Depends(current_user), db: Session = Depends(get_db)):
    incident = owned_incident(db, user, incident_id)
    if payload.status is not None:
        if payload.status not in {"Open","Investigating","Awaiting Review","Resolved","Closed"}: raise HTTPException(422, "Unsupported incident status.")
        incident.status = payload.status
    if payload.resolution_notes is not None: incident.resolution_notes = payload.resolution_notes
    if payload.note:
        notes = list(incident.notes or []); notes.append({"note": payload.note, "at": datetime.now(timezone.utc).isoformat(), "by": user.email}); incident.notes = notes
    db.commit(); db.refresh(incident); add_notification(db, user.company_id, "Incident updated", incident.title); db.commit()
    return serialize_incident(incident)

@app.get("/api/notifications")
def list_notifications(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Notification).where(models.Notification.company_id == user.company_id).order_by(desc(models.Notification.created_at)).limit(100)).all()
    return [serialize_notification(n) for n in rows]

@app.patch("/api/notifications/{notification_id}")
def update_notification(notification_id: int, payload: dict, user=Depends(current_user), db: Session = Depends(get_db)):
    n = db.scalar(select(models.Notification).where(models.Notification.id == notification_id, models.Notification.company_id == user.company_id))
    if not n: raise HTTPException(404, "Notification not found.")
    n.read = bool(payload.get("read", True)); db.commit(); return serialize_notification(n)

@app.post("/api/notifications/mark-all-read")
def mark_all_read(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Notification).where(models.Notification.company_id == user.company_id, models.Notification.read == False)).all()
    for n in rows: n.read = True
    db.commit(); return {"updated": len(rows)}

@app.get("/api/dashboard/summary")
def dashboard_summary(user=Depends(current_user), db: Session = Depends(get_db)):
    threats = db.scalars(select(models.Threat).where(models.Threat.company_id == user.company_id)).all()
    incidents = db.scalars(select(models.Incident).where(models.Incident.company_id == user.company_id)).all()
    notifications = db.scalars(select(models.Notification).where(models.Notification.company_id == user.company_id, models.Notification.read == False)).all()
    scans = db.scalars(select(models.ScanRun).where(models.ScanRun.company_id == user.company_id).order_by(desc(models.ScanRun.created_at)).limit(1)).first()
    return {"total_assets": len(threats), "high_risk": sum(t.risk_score >= 60 for t in threats), "open_investigations": sum(t.status not in {"Resolved","Closed"} for t in threats), "resolved_incidents": sum(i.status == "Resolved" for i in incidents), "unread_notifications": len(notifications), "risk_distribution": {k: sum(t.risk_category == k for t in threats) for k in ["Low","Medium","High","Critical"]}, "platform_distribution": {k: sum(t.asset_type == k for t in threats) for k in sorted({t.asset_type for t in threats})}, "recent_threats": [serialize_threat(t) for t in sorted(threats, key=lambda x: x.last_checked.timestamp() if x.last_checked else 0, reverse=True)[:6]], "last_scan": {"id": scans.id, "status": scans.status, "created_at": scans.created_at.isoformat(), "source": scans.source} if scans else None, "demo_notice": "Manual rule-based analysis only. Synthetic examples are labeled; external platforms are not scanned."}

@app.get("/api/dashboard/charts")
def dashboard_charts(user=Depends(current_user), db: Session = Depends(get_db)):
    threats = db.scalars(select(models.Threat).where(models.Threat.company_id == user.company_id)).all()
    daily = {}
    for t in threats:
        day = (t.first_seen.date().isoformat() if t.first_seen else "Unknown")
        daily[day] = daily.get(day, 0) + 1
    return {"findings_over_time": [{"date": k, "count": v} for k,v in sorted(daily.items())[-14:]], "risk_distribution": {k: sum(t.risk_category == k for t in threats) for k in ["Low","Medium","High","Critical"]}, "platform_distribution": {k: sum(t.asset_type == k for t in threats) for k in sorted({t.asset_type for t in threats})}}

@app.get("/api/reports/incidents.csv")
def export_incidents(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Incident).where(models.Incident.company_id == user.company_id).order_by(models.Incident.id)).all()
    output = io.StringIO(); writer = csv.writer(output); writer.writerow(["incident_id","threat_id","title","severity","status","description","resolution_notes","created_at"])
    for i in rows: writer.writerow([i.id,i.threat_id,i.title,i.severity,i.status,i.description,i.resolution_notes,i.created_at.isoformat() if i.created_at else ""])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition":"attachment; filename=brandshield-incidents.csv"})

@app.get("/api/reports/threats.csv")
def export_threats(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Threat).where(models.Threat.company_id == user.company_id).order_by(models.Threat.id)).all()
    output = io.StringIO(); writer = csv.writer(output); writer.writerow(["threat_id","candidate","asset_type","risk_score","risk_category","status","synthetic","reasons"])
    for t in rows: writer.writerow([t.id,t.candidate,t.asset_type,t.risk_score,t.risk_category,t.status,t.synthetic," | ".join(t.reasons or [])])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition":"attachment; filename=brandshield-threats.csv"})

@app.post("/api/evidence", status_code=201)
async def upload_evidence(threat_id: int, file: UploadFile = File(...), user=Depends(current_user), db: Session = Depends(get_db)):
    threat = owned_threat(db, user, threat_id)
    allowed = {"image/png", "image/jpeg", "image/webp", "text/plain", "application/pdf"}
    if file.content_type not in allowed: raise HTTPException(415, "Only PNG, JPEG, WebP, plain text, or PDF evidence is accepted.")
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024: raise HTTPException(413, "Evidence file must be 5 MB or smaller.")
    # Check common magic bytes rather than trusting the extension/MIME header alone.
    signatures = {"image/png": b"\x89PNG\r\n\x1a\n", "image/jpeg": b"\xff\xd8\xff", "image/webp": b"RIFF", "application/pdf": b"%PDF"}
    if file.content_type in signatures and not data.startswith(signatures[file.content_type]): raise HTTPException(415, "File content does not match its declared type.")
    if file.content_type == "image/webp" and data[8:12] != b"WEBP": raise HTTPException(415, "Invalid WebP file.")
    import secrets, os
    ext = {"image/png":".png","image/jpeg":".jpg","image/webp":".webp","text/plain":".txt","application/pdf":".pdf"}[file.content_type]
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True); stored = secrets.token_hex(20) + ext
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f: f.write(data)
    ev = list(threat.evidence or []); ev.append({"type":"uploaded_evidence","file_id":stored,"filename":Path(file.filename or "evidence").name[:150],"content_type":file.content_type,"size":len(data),"uploaded_at":datetime.now(timezone.utc).isoformat()}); threat.evidence = ev; db.commit()
    return {"ok": True, "filename": Path(file.filename or "evidence").name, "size": len(data), "download_url": f"/api/evidence/{stored}/download"}

@app.get("/api/evidence/{file_id}/download")
def download_evidence(file_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    if not re.fullmatch(r"[a-f0-9]{40}\.(png|jpg|webp|txt|pdf)", file_id): raise HTTPException(404, "Evidence not found.")
    # Verify the file is referenced by a threat owned by the current company.
    threats = db.scalars(select(models.Threat).where(models.Threat.company_id == user.company_id)).all()
    match = next((e for t in threats for e in (t.evidence or []) if e.get("file_id") == file_id), None)
    path = os.path.join(UPLOAD_DIR, file_id)
    if not match or not os.path.isfile(path): raise HTTPException(404, "Evidence not found.")
    return FileResponse(path, filename=match.get("filename", "evidence"), media_type=match.get("content_type", "application/octet-stream"))

@app.post("/api/demo/seed")
def seed_demo(user=Depends(current_user), db: Session = Depends(get_db)):
    # Seed is opt-in, scoped to the authenticated company, and explicitly synthetic.
    brand = db.scalar(select(models.BrandProfile).where(models.BrandProfile.company_id == user.company_id))
    if not brand:
        brand = models.BrandProfile(company_id=user.company_id, official_name=user.company.name, official_website=user.company.website); db.add(brand); db.commit(); db.refresh(brand)
    if not brand.official_name: brand.official_name = "HackXcelerate Demo"
    if not brand.official_domains: brand.official_domains = ["hackxcelerate.example"]
    examples = [("hackxxcelerate.example","website"),("hackxcelerate-offers.example","website"),("@hackxcelerate_registration","social profile"),("@hackxcelerate_official1","social profile")]
    added = 0
    for candidate, typ in examples:
        if db.scalar(select(models.Threat).where(models.Threat.company_id == user.company_id, models.Threat.candidate == candidate)): continue
        result = analyze_candidate(candidate, typ, {"official_name":brand.official_name,"alternative_names":brand.alternative_names or [],"official_website":brand.official_website,"official_domains":brand.official_domains or ["hackxcelerate.example"],"verification_status":brand.verification_status})
        db.add(models.Threat(company_id=user.company_id,candidate=candidate,asset_type=typ,platform="Synthetic demo",risk_score=result["risk_score"],risk_category=result["risk_category"],indicator_scores=result["indicator_scores"],reasons=result["reasons"],evidence=result["evidence"],discovery_method="synthetic demo seed",synthetic=True,status="New"))
        added += 1
    if added: add_notification(db, user.company_id, "Synthetic demo data added", f"Added {added} fictional sample assets. These are not real discovered threats."); db.commit()
    return {"added": added, "synthetic": True, "message": "All seeded assets are fictional demonstration records."}

# Static frontend is served by this same origin for simple local setup.
if Path(FRONTEND_DIR).is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
