import os

DATABASE_URL = os.getenv("BRANDSHIELD_DATABASE_URL", "sqlite:///./brandshield.db")
SESSION_COOKIE = os.getenv("BRANDSHIELD_SESSION_COOKIE", "brandshield_session")
COOKIE_SECURE = os.getenv("BRANDSHIELD_COOKIE_SECURE", "false").lower() == "true"
SESSION_HOURS = int(os.getenv("BRANDSHIELD_SESSION_HOURS", "12"))
DEMO_MODE = os.getenv("BRANDSHIELD_DEMO_MODE", "true").lower() == "true"
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../uploads"))
