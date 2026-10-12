"""Admin-level clustering policy for low zooms."""

from __future__ import annotations

from typing import Any

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)
from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.assets.application.usecases.query.viewport_grid import (
    ADMIN_LEVEL_PROVINCE_MAX_ZOOM,
    ADMIN_MUNICIPALITY_HARD_CAP,
    admin_level_for_zoom,
)
from territory.assets.application.usecases.query.viewport_cluster_geojson import (
    admin_features_collection,
)


def admin_clusters_response(
    repository: GreenAssetsLakehouseRepository,
    bbox: tuple[float, float, float, float],
    zoom: float,
    *,
    region_id: int | None,
    province_id: int | None,
    municipality_id: int | None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = None,
    municipality_ids: list[int] | None = None,
) -> GeoJSONFeatureCollection | None:
    """Admin-aggregated clusters for low zooms; None → use the grid/raw path.

    The level follows the zoom band (region < province < municipality) and
    is refined by the request scope, covering the whole drill chain
    Italia > regione > provincia > comune > sottoarea comunale. Inside a
    comune the sub_municipal level applies at the municipality zoom band;
    zooming out past that band collapses to the scoped unit itself (one
    cluster). Municipalities without sub-area rows fall back to grid
    clustering (empty admin response → None).
    """
    level = admin_level_for_zoom(zoom)
    if level is None:
        return None
    # Draw clip: region/province centroids rarely fall inside a sketch;
    # serve municipality units whose extent intersects the polygon.
    if clip_wkt and level in {"region", "province"}:
        level = "municipality"
    # Scope floor + one-step child bump. Cascading `if` bumps previously
    # forced sub_municipal whenever municipality_id was set (region →
    # province → municipality → sub_municipal), so zoom-out never merged
    # circoscrizioni into a single comune cluster.
    _ADMIN_RANK = {
        "region": 0,
        "province": 1,
        "municipality": 2,
        "sub_municipal": 3,
    }
    _ADMIN_CHILDREN = {
        "region": "province",
        "province": "municipality",
        "municipality": "sub_municipal",
    }
    if sub_municipal_area_id is not None:
        scope_floor = "sub_municipal"
    elif municipality_id is not None:
        scope_floor = "municipality"
    elif province_id is not None:
        scope_floor = "province"
    elif region_id is not None:
        scope_floor = "region"
    else:
        scope_floor = None

    if scope_floor is not None:
        if _ADMIN_RANK[level] < _ADMIN_RANK[scope_floor]:
            # Zoom coarser than the selected unit: show that unit as one
            # cluster (gold rows for coarser levels null out child ids,
            # so the scope filter would otherwise return empty).
            level = scope_floor
        elif _ADMIN_RANK[level] == _ADMIN_RANK[scope_floor]:
            # Zoom matches the selected unit: show children instead of a
            # single "self" cluster — but only when zoomed in enough.
            # Province→municipality used to bump for the whole province band
            # (z8–12), flooding the map with ~50 M* markers (debug: zoom
            # 11.2 province_id=75 → 52 clusters). Keep one P* until the
            # municipality band. Circoscrizioni stay near the grid handoff.
            child = _ADMIN_CHILDREN.get(scope_floor)
            child_min_zoom = {
                "province": ADMIN_LEVEL_PROVINCE_MAX_ZOOM,
                "municipality": 12.0,
            }.get(scope_floor)
            if child is not None and (
                child_min_zoom is None or zoom >= child_min_zoom
            ):
                level = child

    clusters = repository.get_admin_clusters_in_bbox(
        level,
        bbox,
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=clip_wkt,
        municipality_ids=municipality_ids,
    )
    # National/region municipality payloads (~7.9k markers) flood FE + encode.
    # Roll up to province when unscoped or region-scoped (keep drill into a
    # single province/municipality intact).
    if (
        level == "municipality"
        and len(clusters) > ADMIN_MUNICIPALITY_HARD_CAP
        and (scope_floor is None or scope_floor == "region")
        and not clip_wkt
    ):
        level = "province"
        clusters = repository.get_admin_clusters_in_bbox(
            level,
            bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            sub_municipal_area_id=sub_municipal_area_id,
            clip_wkt=clip_wkt,
            municipality_ids=municipality_ids,
        )
    # Empty admin must not short-circuit the viewport: callers treat any
    # FeatureCollection (including empty) as final. Fall through to grid/raw
    # when gold has no rows for the resolved ingest window (multi-snapshot).
    if not clusters:
        return None
    # #region agent log
    try:
        import json as _json
        import time as _time
        import urllib.request as _urlreq

        small = [
            {
                "key": c.admin_key,
                "count": c.count,
                "lon": c.lon,
                "lat": c.lat,
            }
            for c in clusters
            if c.count <= 5 or (c.admin_key or "").startswith("R999") or "5998" in (c.admin_key or "")
        ]
        payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "asset-cluster-count",
                "hypothesisId": "H-B-admin-counts",
                "location": "catalog_green_asset._admin_clusters_response",
                "message": "admin_clusters",
                "data": {
                    "level": level,
                    "n": len(clusters),
                    "sum_cluster_count": sum(int(c.count) for c in clusters),
                    "n_municipality_ids": (
                        len(municipality_ids) if municipality_ids is not None else None
                    ),
                    "scope": {
                        "region_id": region_id,
                        "province_id": province_id,
                        "municipality_id": municipality_id,
                    },
                    "zoom": zoom,
                    "interesting": small[:20],
                    "top": [
                        {"key": c.admin_key, "count": c.count}
                        for c in sorted(
                            clusters, key=lambda x: int(x.count), reverse=True
                        )[:5]
                    ],
                },
                "timestamp": int(_time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.5,
        )
    except Exception:
        pass
    # #endregion
    return admin_features_collection(clusters)
