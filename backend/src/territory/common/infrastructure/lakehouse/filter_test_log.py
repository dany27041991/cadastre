"""Optional NDJSON emit for filter-propagation live tests.

Enable with FILTER_TEST_LOG=1 (or set FILTER_TEST_LOG_PATH).
Harness sets headers X-Filter-Test-Case / X-Filter-Test-Scope / X-Filter-Test-Run
via middleware → contextvars.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from contextvars import ContextVar
from pathlib import Path
from typing import Any

_case_id: ContextVar[str | None] = ContextVar("filter_test_case_id", default=None)
_scope_id: ContextVar[str | None] = ContextVar("filter_test_scope_id", default=None)
_run_id: ContextVar[str | None] = ContextVar("filter_test_run_id", default=None)

def _default_log_path() -> Path:
    """Prefer Docker bind-mount path (/app → host cadastre/backend)."""
    docker_path = Path("/app/.filter-test-runtime.ndjson")
    if Path("/app/src").is_dir():
        return docker_path
    # Host-run uvicorn from cadastre/backend
    backend_root = Path(__file__).resolve().parents[5]  # …/backend
    return backend_root / ".filter-test-runtime.ndjson"


def filter_test_log_enabled() -> bool:
    if os.environ.get("FILTER_TEST_LOG", "").strip() in {"1", "true", "yes", "on"}:
        return True
    return bool(os.environ.get("FILTER_TEST_LOG_PATH", "").strip())


def log_path() -> Path:
    raw = os.environ.get("FILTER_TEST_LOG_PATH", "").strip()
    return Path(raw) if raw else _default_log_path()


def bind_request_headers(
    *,
    case_id: str | None = None,
    scope_id: str | None = None,
    run_id: str | None = None,
) -> None:
    if case_id is not None:
        _case_id.set(case_id)
    if scope_id is not None:
        _scope_id.set(scope_id)
    if run_id is not None:
        _run_id.set(run_id)


def clear_request_headers() -> None:
    _case_id.set(None)
    _scope_id.set(None)
    _run_id.set(None)


def _where_sql_hash(where_sql: str | None) -> str:
    if not where_sql:
        return ""
    return hashlib.sha256(where_sql.encode("utf-8")).hexdigest()[:16]


def _range_keys(filters: dict[str, Any] | None) -> list[str]:
    if not filters:
        return []
    return sorted(
        k
        for k, v in filters.items()
        if v is not None
        and str(v).strip() != ""
        and (k.endswith("_min") or k.endswith("_max") or k.endswith("_from") or k.endswith("_to"))
    )


def emit_filter_test_log(
    *,
    kind: str,
    surface: str,
    filters: dict[str, Any] | None,
    total: int | None = None,
    n_features: int | None = None,
    where_sql: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    if not filter_test_log_enabled():
        return
    filt = {
        k: str(v) for k, v in (filters or {}).items() if v is not None and v != ""
    }
    payload: dict[str, Any] = {
        "runId": _run_id.get() or os.environ.get("FILTER_TEST_RUN_ID") or "local",
        "caseId": _case_id.get() or "",
        "scope": _scope_id.get() or "",
        "kind": kind,
        "surface": surface,
        "filters": filt,
        "range_keys": _range_keys(filters),
        "filter_keys": sorted(filt.keys()),
        "total": total,
        "n_features": n_features,
        "where_sql_hash": _where_sql_hash(where_sql),
        "timestamp": int(time.time() * 1000),
    }
    if extra:
        payload["extra"] = extra
    path = log_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, default=str) + "\n")
    except Exception:
        pass
