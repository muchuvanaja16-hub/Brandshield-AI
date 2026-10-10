r"""Convenience entry point: run the Phase 2 Flask backend from the project root.

Usage (PowerShell):
    cd C:\Users\DELL\Downloads\BrandShield-AI
    .venv\Scripts\python.exe run_flask.py
    # or
    python run_flask.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"

# Load optional .env from project root or backend dir.
_env_paths = [PROJECT_ROOT / ".env", BACKEND_DIR / ".env"]
for _p in _env_paths:
    if _p.is_file():
        try:
            from dotenv import load_dotenv
            load_dotenv(_p)
        except Exception:
            # Fall back to manual parsing (no secrets needed in demo mode).
            for _line in _p.read_text(encoding="utf-8").splitlines():
                _line = _line.strip()
                if not _line or _line.startswith("#") or "=" not in _line:
                    continue
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))
        break

# Make backend package importable.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if __name__ == "__main__":
    from app.flask_main import run_dev_server

    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "127.0.0.1")
    run_dev_server(host=host, port=port)
