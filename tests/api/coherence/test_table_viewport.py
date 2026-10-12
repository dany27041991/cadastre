"""Same applied filters → table total vs viewport feature count (municipal)."""

from __future__ import annotations

import pytest

from harness import coherence, discovery, http_client, log_assert

pytestmark = pytest.mark.live


@pytest.mark.parametrize(
    "kind,filter_key",
    [
        ("area", "perimeter_type"),
        ("area", "intensity_of_fruition"),
        ("area", "area_classification"),
        ("asset", "health_status"),
        ("asset", "growth_stage"),
        ("asset", "species"),
    ],
)
def test_municipal_table_viewport_coherent(
    kind: str,
    filter_key: str,
    geo_scopes: dict,
    filter_catalog: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    municipal = geo_scopes["municipal"]
    scope_params = dict(municipal["params"])
    fallback = filter_catalog[kind][filter_key]["fallback"]
    value, _ = discovery.discover_value(
        kind, filter_key, scope_params, fallback, run_id=run_id
    )
    filters = {filter_key: value}
    case_id = f"coherent-{kind}-{filter_key}"

    log_assert.clear()
    table = http_client.table(
        kind,
        scope_params,
        filters,
        case_id=f"{case_id}-table",
        scope="municipal",
        run_id=run_id,
    )
    assert table["status"] == 200
    log_assert.require(case_id=f"{case_id}-table", kind=kind, surface="table")

    log_assert.clear()
    vp = http_client.viewport(
        kind,
        scope_params,
        filters,
        bbox=municipal["bbox"],
        zoom=municipal["zoom"],
        case_id=f"{case_id}-vp",
        scope="municipal",
        run_id=run_id,
    )
    assert vp["status"] == 200
    log_assert.require(case_id=f"{case_id}-vp", kind=kind, surface="viewport")

    coherence.assert_table_viewport_coherent(
        table["total"] or 0,
        vp["entity_count"],
        approx_ok=False,
        label=case_id,
    )
