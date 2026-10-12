"""National filtered /table warm budget (allowlist path B)."""

from __future__ import annotations

import time

import pytest

from harness import http_client, log_assert

pytestmark = [pytest.mark.live, pytest.mark.slow]

# Design budget: warm national attribute filter < 5s (allowlist + single SELECT).
_WARM_BUDGET_S = 5.0


def test_national_name_filter_warm_under_budget(geo_scopes: dict, run_id: str, clear_filter_log) -> None:
    scope = geo_scopes["national"]
    scope_params = dict(scope["params"])
    case_id = "table-national-allowlist-villa"
    filters = {"name": "villa"}

    # Cold prime (not timed against budget).
    cold = http_client.table(
        "area",
        scope_params,
        filters,
        case_id=f"{case_id}-cold",
        scope="national",
        run_id=run_id,
        page=1,
        page_size=10,
    )
    assert cold["status"] == 200, cold["raw"]

    log_assert.clear()
    t0 = time.perf_counter()
    warm = http_client.table(
        "area",
        scope_params,
        filters,
        case_id=case_id,
        scope="national",
        run_id=run_id,
        page=1,
        page_size=10,
    )
    elapsed = time.perf_counter() - t0
    assert warm["status"] == 200, warm["raw"]
    assert warm["total"] is not None
    assert elapsed < _WARM_BUDGET_S, (
        f"national warm filtered /table took {elapsed:.2f}s (budget {_WARM_BUDGET_S}s)"
    )
    log_assert.require(case_id=case_id, kind="area", surface="table", filter_key="name")
