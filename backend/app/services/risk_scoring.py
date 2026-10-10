import re
from urllib.parse import urlparse
from difflib import SequenceMatcher

MISLEADING_TERMS = {"offers", "support", "registration", "register", "official", "secure", "payment", "rewards", "claim", "bonus", "verify", "login", "helpdesk"}

def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())

def similarity(a: str, b: str) -> int:
    a, b = normalize_name(a), normalize_name(b)
    if not a or not b: return 0
    return round(SequenceMatcher(None, a, b).ratio() * 100)

def extract_host(candidate: str) -> str:
    raw = candidate.strip()
    parsed = urlparse(raw if "://" in raw else "https://" + raw)
    host = (parsed.hostname or "").lower().strip(".")
    return host

def registrableish_domain(host: str) -> str:
    # Conservative fallback for common multi-label public suffixes. For production, use a maintained PSL library.
    parts = host.lower().split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in {"co.uk", "com.au", "co.in", "com.sg", "co.nz"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host

def analyze_candidate(candidate: str, asset_type: str, brand: dict) -> dict:
    official_names = [brand.get("official_name", "")] + list(brand.get("alternative_names") or [])
    official_names = [x for x in official_names if x.strip()]
    candidate_host = extract_host(candidate) if asset_type.lower() in {"website", "domain", "registration page", "url"} or "." in candidate else ""
    host_label = candidate_host.split(".")[0] if candidate_host else candidate.lstrip("@").split("/")[0]
    best_name = max((similarity(host_label, n) for n in official_names), default=0)
    domain_score = 0
    official_domains = list(brand.get("official_domains") or [])
    official_website = brand.get("official_website", "")
    if official_website: official_domains.append(official_website)
    normalized_official_hosts = {extract_host(d) for d in official_domains if d}
    if candidate_host:
        candidate_root = registrableish_domain(candidate_host)
        for host in normalized_official_hosts:
            if not host: continue
            official_root = registrableish_domain(host)
            if candidate_host == host or candidate_root == official_root:
                domain_score = max(domain_score, 0)
            else:
                domain_score = max(domain_score, similarity(candidate_root.split('.')[0], official_root.split('.')[0]))
    lower = candidate.lower()
    terms = sorted(t for t in MISLEADING_TERMS if t in lower)
    affiliation_score = 20 if any(t in lower for t in ["official", "support", "registration", "payment", "secure", "offers"]) else 0
    suspicious_term_score = min(100, len(terms) * 24)
    # Weighted, explainable heuristic. Missing fields add no risk.
    indicators = {
        "brand_name_similarity": best_name,
        "domain_similarity": domain_score,
        "suspicious_terms": suspicious_term_score,
        "affiliation_language": affiliation_score,
        "ownership_verification": 0 if brand.get("verification_status") == "verified" else 10,
    }
    weighted = (best_name * 0.40) + (domain_score * 0.30) + (suspicious_term_score * 0.15) + (affiliation_score * 0.10) + (indicators["ownership_verification"] * 0.05)
    score = max(0, min(100, round(weighted)))
    category = "Low" if score < 30 else "Medium" if score < 60 else "High" if score < 80 else "Critical"
    reasons = []
    if best_name >= 55: reasons.append(f"Candidate name has {best_name}% similarity to a registered brand name.")
    if domain_score >= 45: reasons.append(f"Candidate domain label has {domain_score}% similarity to an official domain label.")
    if terms: reasons.append("Potentially misleading terms detected: " + ", ".join(terms) + ".")
    if affiliation_score: reasons.append("Candidate contains wording commonly used to imply official support, registration, or payment.")
    if brand.get("verification_status") != "verified": reasons.append("Official brand ownership has not been independently verified; this is context, not proof of threat.")
    if not reasons: reasons.append("No strong configured indicators were found. Review the asset manually; a low score does not guarantee safety.")
    return {"risk_score": score, "risk_category": category, "indicator_scores": indicators, "reasons": reasons,
            "evidence": [{"type": "submitted_candidate", "value": candidate}, {"type": "analysis_method", "value": "Transparent rule-based similarity heuristic; not a trained ML model."}],
            "limitations": ["A similar name or domain does not prove fraud.", "No external platform was queried.", "Score depends on submitted text and configured brand references."]}
