"""Filtered viewport at cluster zoom ≤ unfiltered baseline (municipal + national)."""

from __future__ import annotations

import pytest

from harness import http_client, log_assert

pytestmark = pytest.mark.live


@pytest.mark.parametrize(
    "scope_id,kind,filters,zoom",
    [
        ("municipal", "asset", {"health_status": "HEALTHY"}, 11),
        # Areas viewport empty below VIEWPORT_AREAS_MIN_ZOOM (12)
        ("municipal", "area", {"perimeter_type": "REAL"}, 13),
        pytest.param(
            "national",
            "asset",
            {"health_status": "HEALTHY"},
            6,
            marks=pytest.mark.slow,
        ),
    ],
)
def test_filtered_viewport_not_above_baseline(
    scope_id: str,
    kind: str,
    filters: dict,
    zoom: float,
    geo_scopes: dict,
    run_id: str,
    clear_filter_log,
) -> None:
    scope = geo_scopes[scope_id]
    params = {k: v for k, v in scope["params"].items() if k != "green_area_id"}
    bbox = scope["bbox"]
    case_id = f"cluster-{scope_id}-{kind}"

    log_assert.clear()
    baseline = http_client.viewport(
        kind,
        params,
        None,
        bbox=bbox,
        zoom=zoom,
        case_id=f"{case_id}-base",
        scope=scope_id,
        run_id=run_id,
    )
    assert baseline["status"] == 200

    log_assert.clear()
    filtered = http_client.viewport(
        kind,
        params,
        filters,
        bbox=bbox,
        zoom=zoom,
        case_id=case_id,
        scope=scope_id,
        run_id=run_id,
    )
    assert filtered["status"] == 200, filtered["raw"]
    assert filtered["entity_count"] <= baseline["entity_count"]
    log_assert.require(case_id=case_id, kind=kind, surface="viewport")
