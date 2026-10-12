"""Smoke: 1 area + 1 asset filter per geo scope (N/R/P/municipal/sub)."""

from __future__ import annotations

import pytest

from harness import discovery, http_client, log_assert

pytestmark = pytest.mark.live


@pytest.mark.parametrize(
    "scope_id",
    [
        pytest.param("national", marks=pytest.mark.slow),
        pytest.param("regional", marks=pytest.mark.slow),
        pytest.param("provincial", marks=pytest.mark.slow),
        "municipal",
        "submunicipal",
    ],
)
def test_geo_scope_area_and_asset_smoke(
    scope_id: str,
    geo_scopes: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    scope = geo_scopes[scope_id]
    params = dict(scope["params"])
    area_params = {k: v for k, v in params.items() if k != "green_area_id"}
    asset_params = dict(area_params)
    if scope.get("discover_green_area_id"):
        ga = discovery.discover_green_area_id(area_params, run_id=run_id)
        if ga is None:
            pytest.skip("no green_area_id for submunicipal")
        # Areas: exact row via area_id; assets: members via green_area_id
        area_params = {**area_params, "area_id": ga}
        asset_params = {**asset_params, "green_area_id": ga}

    case_area = f"smoke-{scope_id}-area"
    log_assert.clear()
    base_a = http_client.table(
        "area",
        area_params,
        None,
        case_id=f"{case_area}-base",
        scope=scope_id,
        run_id=run_id,
    )
    assert base_a["status"] == 200
    log_assert.clear()
    area_filters = {} if scope_id == "submunicipal" else {"perimeter_type": "REAL"}
    filt_a = http_client.table(
        "area",
        area_params,
        area_filters,
        case_id=case_area,
        scope=scope_id,
        run_id=run_id,
    )
    assert filt_a["status"] == 200
    assert filt_a["total"] <= (base_a["total"] or 0)
    log_assert.require(case_id=case_area, kind="area", surface="table")

    case_asset = f"smoke-{scope_id}-asset"
    log_assert.clear()
    base_s = http_client.table(
        "asset",
        asset_params,
        None,
        case_id=f"{case_asset}-base",
        scope=scope_id,
        run_id=run_id,
    )
    assert base_s["status"] == 200
    log_assert.clear()
    filt_s = http_client.table(
        "asset",
        asset_params,
        {"health_status": "HEALTHY"},
        case_id=case_asset,
        scope=scope_id,
        run_id=run_id,
    )
    assert filt_s["status"] == 200
    assert filt_s["total"] <= (base_s["total"] or 0)
    log_assert.require(case_id=case_asset, kind="asset", surface="table")
