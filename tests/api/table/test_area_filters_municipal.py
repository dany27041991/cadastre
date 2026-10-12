"""Municipal Lecce: every AREA filter key on /green-areas/table + NDJSON evidence."""

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
        "name",
        "area_code",
        "surface_area_m2",
        "area_classification",
        "istat_classification",
        "intensity_of_fruition",
        "perimeter_type",
        "survey_date",
    ],
)
def test_area_filter_restricts_table(
    filter_key: str,
    municipal: dict,
    filter_catalog: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    scope_params = dict(municipal["params"])
    meta = filter_catalog["area"][filter_key]
    value, from_disc = discovery.discover_value(
        "area", filter_key, scope_params, meta["fallback"], run_id=run_id
    )
    params = discovery.filter_query_params(filter_key, value, meta)
    log_key = discovery.primary_log_key(filter_key, meta)
    case_id = f"table-area-{filter_key}"

    log_assert.clear()
    baseline = http_client.table(
        "area",
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
        "area",
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
        case_id=case_id, kind="area", surface="table", filter_key=log_key
    )
    assert entry.get("total") == filtered["total"]


def test_area_full_and_all_fields(
    municipal: dict, filter_catalog: dict, run_id: str, clear_filter_log
) -> None:
    """All area catalog fields AND (incl. surface/date ranges) on /table."""
    scope_params = dict(municipal["params"])
    case_id = "table-area-full-and"
    filters: dict[str, str] = {}
    for key, meta in filter_catalog["area"].items():
        value, _ = discovery.discover_value(
            "area", key, scope_params, meta["fallback"], run_id=run_id
        )
        filters.update(discovery.filter_query_params(key, value, meta))
    log_assert.clear()
    baseline = http_client.table(
        "area", scope_params, None, case_id=f"{case_id}-base", scope="municipal", run_id=run_id
    )
    assert baseline["status"] == 200
    log_assert.clear()
    filtered = http_client.table(
        "area", scope_params, filters, case_id=case_id, scope="municipal", run_id=run_id
    )
    assert filtered["status"] == 200, filtered["raw"]
    assert filtered["total"] is not None
    assert filtered["total"] <= baseline["total"]
    entry = log_assert.require(case_id=case_id, kind="area", surface="table")
    assert "surface_area_m2_min" in (entry.get("filters") or {})
    assert "survey_date_from" in (entry.get("filters") or {})


def test_area_and_two_filters(municipal: dict, run_id: str, clear_filter_log) -> None:
    scope_params = dict(municipal["params"])
    case_id = "table-area-and"
    log_assert.clear()
    baseline = http_client.table(
        "area", scope_params, None, case_id=f"{case_id}-base", scope="municipal", run_id=run_id
    )
    assert baseline["status"] == 200
    log_assert.clear()
    filtered = http_client.table(
        "area",
        scope_params,
        {"perimeter_type": "REAL", "intensity_of_fruition": "LOW"},
        case_id=case_id,
        scope="municipal",
        run_id=run_id,
    )
    assert filtered["status"] == 200
    assert filtered["total"] <= baseline["total"]
    log_assert.require(case_id=case_id, kind="area", surface="table")
