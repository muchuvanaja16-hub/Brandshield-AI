"""Optional CLI helper: create a clearly synthetic demo company and sample assets."""
import sys
from pathlib import Path
BACKEND_DIR = str(Path(__file__).resolve().parents[2])
if BACKEND_DIR not in sys.path: sys.path.insert(0, BACKEND_DIR)
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app import models
from app.security import hash_password
from app.services.risk_scoring import analyze_candidate
Base.metadata.create_all(bind=engine)
EMAIL = "demo@brandshield.test"
with SessionLocal() as db:
    user = db.scalar(select(models.User).where(models.User.email == EMAIL))
    if not user:
        company = models.Company(name="HackXcelerate Demo", industry="Events", website="https://hackxcelerate.example", email=EMAIL, description="Fictional hackathon company for BrandShield AI demonstration.")
        db.add(company); db.flush()
        user = models.User(company_id=company.id, email=EMAIL, password_hash=hash_password("DemoPass123!"), role="admin")
        brand = models.BrandProfile(company_id=company.id, official_name="HackXcelerate Demo", official_website="https://hackxcelerate.example", official_domains=["hackxcelerate.example"], verification_status="unverified")
        db.add_all([user, brand]); db.flush()
        examples = [("hackxxcelerate.example","website","New"),("hackxcelerate-offers.example","website","Under Investigation"),("@hackxcelerate_registration","social profile","Awaiting Review"),("@hackxcelerate_official1","social profile","New")]
        for candidate, typ, status in examples:
            r = analyze_candidate(candidate, typ, {"official_name":brand.official_name,"alternative_names":[],"official_website":brand.official_website,"official_domains":brand.official_domains,"verification_status":"unverified"})
            db.add(models.Threat(company_id=company.id,candidate=candidate,asset_type=typ,platform="Synthetic demo",risk_score=r["risk_score"],risk_category=r["risk_category"],indicator_scores=r["indicator_scores"],reasons=r["reasons"],evidence=r["evidence"],discovery_method="synthetic demo seed",synthetic=True,status=status))
        db.add(models.Notification(company_id=company.id,title="Demo workspace ready",message="All sample candidates are fictional and were not discovered online.",kind="info"))
        db.commit()
        print("Created synthetic demo user: demo@brandshield.test / DemoPass123!")
    else:
        print("Demo user already exists; no changes made.")
