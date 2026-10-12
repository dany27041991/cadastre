"""Pre-aggregated grid gold clusters for mid/high zoom bands."""

from __future__ import annotations

import math

from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.gold.admin import _intersects_bbox
from territory.common.infrastructure.lakehouse.gold.constants import (
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
    _WEB_MERCATOR_HALF,
)
from territory.common.infrastructure.lakehouse.gold.io import _read_gold_rows


def _lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * _WEB_MERCATOR_HALF / 180.0
    y = (
        math.log(math.tan(math.radians(90.0 + lat) / 2.0))
        * _WEB_MERCATOR_HALF
        / math.pi
    )
    return x, y


def read_grid_clusters(
    resolutions: list[IngestResolution],
    zoom_level: int,
    bbox: tuple[float, float, float, float],
) -> list[ViewportCluster]:
    z = min(max(zoom_level, CLUSTER_MAX_ZOOM_THRESHOLD), CLUSTER_GRID_MAX_REFINE_ZOOM)
    rows = _read_gold_rows(resolutions, f"grid_{z}")
    if not rows:
        return []

    buckets: dict[tuple[int, int], list[tuple]] = {}
    for r in rows:
        if not _intersects_bbox(r, bbox):
            continue
        cx, cy = int(r[4]), int(r[5])
        buckets.setdefault((cx, cy), []).append(r)

    clusters: list[ViewportCluster] = []
    for (cx, cy), members in buckets.items():
        total = sum(int(m[6]) for m in members)
        sample_id = int(members[0][7])
        lon = sum(float(m[8]) for m in members) / len(members)
        lat = sum(float(m[9]) for m in members) / len(members)
        mx, my = _lonlat_to_mercator(lon, lat)
        bbox_out = (
            min(float(m[10]) for m in members),
            min(float(m[11]) for m in members),
            max(float(m[12]) for m in members),
            max(float(m[13]) for m in members),
        )
        clusters.append(
            ViewportCluster(
                cell_x=cx,
                cell_y=cy,
                count=total,
                merc_x=mx,
                merc_y=my,
                bbox=bbox_out,
                sample_id=sample_id,
            )
        )
    return clusters
