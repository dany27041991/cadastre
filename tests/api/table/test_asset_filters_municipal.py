"""Municipal Lecce: every ASSET filter key on /green-assets/table + NDJSON evidence."""

from __future__ import annotations

import pytest

from harness import discovery, http_client, log_assert

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def municipal(geo_scopes: dict) -> dict:
    return geo_scopes["municipal"]


@pytest.mark.parametrize(
    "filter_key",
    [
        "plant_code",
        "area_code",
        "species_code",
        "latitude",
        "longitude",
        "species",
        "genus",
        "variety",
        "trunk_diameter_cm",
        "plant_height_m",
        "crown_diameter_m",
        "survey_date",
        "growth_stage",
        "protection_status",
        "health_status",
    ],
)
def test_asset_filter_restricts_table(
    filter_key: str,
    municipal: dict,
    filter_catalog: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    scope_params = dict(municipal["params"])
    meta = filter_catalog["asset"][filter_key]
    value, from_disc = discovery.discover_value(
        "asset", filter_key, scope_params, meta["fallback"], run_id=run_id
    )
    params = discovery.filter_query_params(filter_key, value, meta)
    log_key = discovery.primary_log_key(filter_key, meta)
    case_id = f"table-asset-{filter_key}"

    log_assert.clear()
    baseline = http_client.table(
        "asset",
        scope_params,
        None,
        case_id=f"{case_id}-base",
        scope="municipal",
        run_id=run_id,
    )
    assert baseline["status"] == 200
    assert baseline["total"] is not None and baseline["total"] > 0

    log_assert.clear()
    filtered = http_client.table(
        "asset",
        scope_params,
        params,
        case_id=case_id,
        scope="municipal",
        run_id=run_id,
    )
    assert filtered["status"] == 200, filtered["raw"]
    assert filtered["total"] is not None
    assert filtered["total"] <= baseline["total"]
    if from_disc:
        assert filtered["total"] >= 1

    entry = log_assert.require(
        case_id=case_id, kind="asset", surface="table", filter_key=log_key
    )
    assert entry.get("total") == filtered["total"]


def test_asset_full_and_all_fields(
    municipal: dict, filter_catalog: dict, run_id: str, clear_filter_log
) -> None:
    """All asset catalog fields AND (incl. measure/date ranges) on /table."""
    scope_params = dict(municipal["params"])
    case_id = "table-asset-full-and"
    filters: dict[str, str] = {}
    for key, meta in filter_catalog["asset"].items():
        value, _ = discovery.discover_value(
            "asset", key, scope_params, meta["fallback"], run_id=run_id
        )
        filters.update(discovery.filter_query_params(key, value, meta))
    log_assert.clear()
    baseline = http_client.table(
        "asset", scope_params, None, case_id=f"{case_id}-base", scope="municipal", run_id=run_id
    )
    assert baseline["status"] == 200
    log_assert.clear()
    filtered = http_client.table(
        "asset", scope_params, filters, case_id=case_id, scope="municipal", run_id=run_id
    )
    assert filtered["status"] == 200, filtered["raw"]
    assert filtered["total"] is not None
    assert filtered["total"] <= baseline["total"]
    entry = log_assert.require(case_id=case_id, kind="asset", surface="table")
    assert "trunk_diameter_cm_min" in (entry.get("filters") or {})
    assert "survey_date_from" in (entry.get("filters") or {})


def test_asset_and_health_species(municipal: dict, run_id: str, clear_filter_log) -> None:
    scope_params = dict(municipal["params"])
    case_id = "table-asset-and"
    log_assert.clear()
    baseline = http_client.table(
        "asset", scope_params, None, case_id=f"{case_id}-base", scope="municipal", run_id=run_id
    )
    assert baseline["status"] == 200
    log_assert.clear()
    filtered = http_client.table(
        "asset",
        scope_params,
        {"health_status": "HEALTHY", "growth_stage": "MATURE"},
        case_id=case_id,
        scope="municipal",
        run_id=run_id,
    )
    assert filtered["status"] == 200
    assert filtered["total"] <= baseline["total"]
    log_assert.require(case_id=case_id, kind="asset", surface="table")
