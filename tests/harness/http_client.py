"""HTTP client for green table/viewport filter tests."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_BASE = os.environ.get("API_BASE", "http://localhost:8000").rstrip("/")
DATE_FROM = os.environ.get("FILTER_TEST_DATE_FROM", "2020-01-01")
DATE_TO = os.environ.get("FILTER_TEST_DATE_TO", "2026-10-09")


def api_reachable(base: str | None = None, timeout: float = 2.0) -> bool:
    url = f"{(base or DEFAULT_BASE)}/health"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except Exception:
        try:
            # some stacks expose health under /api
            with urllib.request.urlopen(
                f"{(base or DEFAULT_BASE)}/api/health", timeout=timeout
            ) as resp:
                return 200 <= resp.status < 300
        except Exception:
            # fall back: probe a cheap table call
            try:
                q = urllib.parse.urlencode(
                    {"date_from": DATE_FROM, "date_to": DATE_TO, "page": 1, "page_size": 1}
                )
                with urllib.request.urlopen(
                    f"{(base or DEFAULT_BASE)}/api/territory/green-areas/table?{q}",
                    timeout=timeout,
                ) as resp:
                    return resp.status == 200
            except Exception:
                return False


def _request(
    path: str,
    params: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 120.0,
) -> tuple[int, Any]:
    clean = {k: v for k, v in params.items() if v is not None and v != ""}
    qs = urllib.parse.urlencode(clean, doseq=True)
    url = f"{DEFAULT_BASE}{path}?{qs}"
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body) if body else None
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body) if body else None
        except json.JSONDecodeError:
            return exc.code, body


def _test_headers(case_id: str, scope: str, run_id: str) -> dict[str, str]:
    return {
        "X-Filter-Test-Case": case_id,
        "X-Filter-Test-Scope": scope,
        "X-Filter-Test-Run": run_id,
        "Accept": "application/json",
    }


def table(
    kind: str,
    scope_params: dict[str, Any],
    filters: dict[str, Any] | None = None,
    *,
    case_id: str,
    scope: str,
    run_id: str = "local",
    page: int = 1,
    page_size: int = 5,
) -> dict[str, Any]:
    assert kind in {"area", "asset"}
    path = (
        "/api/territory/green-areas/table"
        if kind == "area"
        else "/api/territory/green-assets/table"
    )
    params: dict[str, Any] = {
        "date_from": DATE_FROM,
        "date_to": DATE_TO,
        "page": page,
        "page_size": page_size,
        **scope_params,
        **(filters or {}),
    }
    # Provincial/national table scans can exceed 120s on cold DuckDB.
    status, body = _request(
        path,
        params,
        headers=_test_headers(case_id, scope, run_id),
        timeout=300.0,
    )
    total = body.get("total") if isinstance(body, dict) else None
    data = body.get("data") if isinstance(body, dict) else None
    return {
        "status": status,
        "total": int(total) if total is not None else None,
        "data": data or [],
        "raw": body,
        "params": params,
    }


def viewport(
    kind: str,
    scope_params: dict[str, Any],
    filters: dict[str, Any] | None = None,
    *,
    bbox: list[float],
    zoom: float,
    case_id: str,
    scope: str,
    run_id: str = "local",
) -> dict[str, Any]:
    assert kind in {"area", "asset"}
    path = (
        "/api/territory/green-areas/viewport"
        if kind == "area"
        else "/api/territory/green-assets/viewport"
    )
    bbox_s = ",".join(str(x) for x in bbox)
    params: dict[str, Any] = {
        "date_from": DATE_FROM,
        "date_to": DATE_TO,
        "bbox": bbox_s,
        "zoom": zoom,
        **scope_params,
        **(filters or {}),
    }
    status, body = _request(
        path, params, headers=_test_headers(case_id, scope, run_id), timeout=180.0
    )
    feats: list = []
    if isinstance(body, dict):
        raw_feats = body.get("features")
        if isinstance(raw_feats, list):
            feats = raw_feats
    n_features = len(feats)
    # Gold clusters expose cluster_count; filtered silver returns one feature per asset.
    entity_count = 0
    for feat in feats:
        props = feat.get("properties") if isinstance(feat, dict) else None
        if isinstance(props, dict) and props.get("cluster") is True:
            cc = props.get("cluster_count")
            try:
                entity_count += int(cc) if cc is not None else 1
            except (TypeError, ValueError):
                entity_count += 1
        else:
            entity_count += 1
    return {
        "status": status,
        "n_features": n_features,
        "entity_count": entity_count,
        "raw": body,
        "params": params,
    }
