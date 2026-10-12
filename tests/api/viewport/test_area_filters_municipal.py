"""Municipal Lecce: AREA filters on /green-areas/viewport + NDJSON."""

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
        "area_classification",
        "intensity_of_fruition",
        "perimeter_type",
        "survey_date",
    ],
)
def test_area_filter_viewport(
    filter_key: str,
    municipal: dict,
    filter_catalog: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    scope_params = dict(municipal["params"])
    bbox = municipal["bbox"]
    zoom = municipal["zoom"]
    meta = filter_catalog["area"][filter_key]
    value, _ = discovery.discover_value(
        "area", filter_key, scope_params, meta["fallback"], run_id=run_id
    )
    params = discovery.filter_query_params(filter_key, value, meta)
    log_key = discovery.primary_log_key(filter_key, meta)
    case_id = f"viewport-area-{filter_key}"

    log_assert.clear()
    baseline = http_client.viewport(
        "area",
        scope_params,
        None,
        bbox=bbox,
        zoom=zoom,
        case_id=f"{case_id}-base",
        scope="municipal",
        run_id=run_id,
    )
    assert baseline["status"] == 200

    log_assert.clear()
    filtered = http_client.viewport(
        "area",
        scope_params,
        params,
        bbox=bbox,
        zoom=zoom,
        case_id=case_id,
        scope="municipal",
        run_id=run_id,
    )
    assert filtered["status"] == 200, filtered["raw"]
    assert filtered["entity_count"] <= baseline["entity_count"]
    log_assert.require(
        case_id=case_id, kind="area", surface="viewport", filter_key=log_key
    )
