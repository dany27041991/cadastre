"""
Pytest configuration for cadastre backend tests.
Aggiunge backend/src al PYTHONPATH per importare main e moduli applicativi.
"""
from __future__ import annotations

import sys
from pathlib import Path

# backend/tests -> backend -> backend/src
_backend_root = Path(__file__).resolve().parent.parent
_src = _backend_root / "src"
if _src.exists() and str(_src) not in sys.path:
    sys.path.insert(0, str(_src))
