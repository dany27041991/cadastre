"""Clear / require NDJSON entries written by BE emit_filter_test_log."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

# BE (Docker) writes under cadastre/backend via /app mount; copy also ok under reports/
_BACKEND_LOG = Path(__file__).resolve().parents[2] / "backend" / ".filter-test-runtime.ndjson"
_REPORTS_LOG = Path(__file__).resolve().parents[1] / "reports" / "runtime-ndjson.log"


def log_path() -> Path:
    """Host harness reads the file the API container writes via /app mount."""
    raw = os.environ.get("FILTER_TEST_LOG_PATH", "").strip()
    if raw.startswith("/app/"):
        # Container path → host bind mount
        return _BACKEND_LOG
    if raw:
        return Path(raw)
    return _BACKEND_LOG if _BACKEND_LOG.parent.is_dir() else _REPORTS_LOG


def clear() -> None:
    path = log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")


def read_entries() -> list[dict[str, Any]]:
    path = log_path()
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def require(
    *,
    case_id: str | None = None,
    kind: str | None = None,
    surface: str | None = None,
    filter_key: str | None = None,
    timeout_s: float = 2.0,
    poll_s: float = 0.05,
) -> dict[str, Any]:
    """Poll until a matching NDJSON entry appears; raise AssertionError if not."""
    deadline = time.time() + timeout_s
    last: list[dict[str, Any]] = []
    while time.time() < deadline:
        last = read_entries()
        for e in reversed(last):
            if case_id is not None and e.get("caseId") != case_id:
                continue
            if kind is not None and e.get("kind") != kind:
                continue
            if surface is not None and e.get("surface") != surface:
                continue
            if filter_key is not None:
                filters = e.get("filters") or {}
                if filter_key not in filters:
                    continue
            return e
        time.sleep(poll_s)
    raise AssertionError(
        f"No NDJSON entry matching caseId={case_id!r} kind={kind!r} "
        f"surface={surface!r} filter_key={filter_key!r}; last={last[-5:]}"
    )
