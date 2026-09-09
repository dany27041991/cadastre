"""Viewport grid clustering parameters.

Faithful port of the frontend grid clustering math
(frontend/src/features/territory/lib/greenAssetClusterCore.ts), so server-side
clusters land on the same grid cells the client used to compute locally.
All distances are pixels at the given zoom; cell sizes are Web Mercator meters.
"""

from __future__ import annotations

import math

WEB_MERCATOR_BASE_RESOLUTION = 156543.03392804097
# Latitude used by the frontend for resolution (Italy centroid).
GRID_REFERENCE_LATITUDE = 41.9

CLUSTER_MAX_ZOOM_THRESHOLD = 13
CLUSTER_ZOOM_DETAIL = 16
CLUSTER_ZOOM_OVERVIEW = 10
CLUSTER_DISTANCE_AT_16 = 80
CLUSTER_DISTANCE_AT_10 = 260
PRECOMPUTE_MIN_LEVEL = 10
PRECOMPUTE_MAX_LEVEL = 12

# Individual assets are shown only at the vendor's last discrete zoom level
# (~19.17; the previous one is 17.85). Below this, always clusters: keeps every
# other level lightweight and skips the bbox count query on pan refreshes.
RAW_MIN_ZOOM = 19.0

# At the last zoom level the response is always raw (no count-based flip back
# to clusters: hysteresis kept clusters on screen after a drill, hiding the
# assets). The cap bounds what the map client can actually render: the vendor
# canvas measured 0.5-1.5s frames above ~1000 mounted features and the mount
# churn triggered multi-second Firefox GC pauses.
# 800 points already saturate a screen visually; denser synthetic seeds
# (13k points in the Lecce test zone) cannot be drawn fluidly feature-by-feature.
LAST_ZOOM_RAW_HARD_CAP = 800

# Grid gold can explode on wide viewports after national seed (measured on a
# ~558-muni NW Italy bbox: z15≈104k feats/12s, z16≈286k/40s, z18 timeout).
# Cap what we return to the map; above this fall back / coarsen.
GRID_CLUSTER_HARD_CAP = 1500
# If more municipalities intersect the bbox, keep municipality admin markers
# instead of opening fine grid_{z} Parquet (avoids multi-minute DuckDB reads).
GRID_ADMIN_HANDOFF_MAX_MUNICIPALITIES = 80

# Raw silver scan opens one Parquet per municipality (measured: 3 muni≈29ms,
# 558≈3.5–4s, 7895≈41–56s). Above this count keep clusters instead of points.
RAW_MAX_MUNICIPALITIES = 40

# National municipality admin at z12+ returns ~7.9k markers / ~1MB / 0.5–1.2s.
# Roll up to province when the payload would flood the map.
ADMIN_MUNICIPALITY_HARD_CAP = 1500

# Deepest zoom whose resolution still refines the cluster grid; past this the
# raw threshold takes over anyway.
CLUSTER_GRID_MAX_REFINE_ZOOM = 18

# Zoom bands for pre-aggregated administrative clusters (gold Parquet).
# Below these zooms a live grid aggregation would scan every asset row in the
# bbox (unbounded at national scale); admin aggregates are O(#admin units).
# Tuned for national ~8k municipalities: keep province through z11 so a
# mid-zoom provincial strip does not flood the map with overlapping M* markers.
ADMIN_LEVEL_REGION_MAX_ZOOM = 8
ADMIN_LEVEL_PROVINCE_MAX_ZOOM = 12


def admin_level_for_zoom(zoom: float) -> str | None:
    """Administrative aggregation level for the given zoom; None = grid/raw."""
    if zoom < ADMIN_LEVEL_REGION_MAX_ZOOM:
        return "region"
    if zoom < ADMIN_LEVEL_PROVINCE_MAX_ZOOM:
        return "province"
    if zoom < CLUSTER_MAX_ZOOM_THRESHOLD:
        return "municipality"
    return None

_WEB_MERCATOR_HALF_CIRCUMFERENCE = 20037508.34


def resolution_for_zoom(zoom: float) -> float:
    """Web Mercator resolution (m/px) at the grid reference latitude."""
    scale = WEB_MERCATOR_BASE_RESOLUTION * math.cos(math.radians(GRID_REFERENCE_LATITUDE))
    return scale / 2**zoom


def cluster_distance_px(zoom: float) -> float:
    """Grid distance in pixels for the given zoom.

    Constant past the raw threshold: the previous +55px/zoom growth cancelled the
    resolution halving, so the cell size in meters barely shrank and clusters
    never split while zooming in (debug logs: 53 -> 50 -> 32 cells from zoom
    14.5 to 16.8, then an abrupt jump to 1822 raw assets).
    """
    z = math.floor(zoom)
    if z >= CLUSTER_MAX_ZOOM_THRESHOLD:
        return CLUSTER_DISTANCE_AT_16
    t = max(
        0.0,
        min(1.0, (CLUSTER_ZOOM_DETAIL - z) / (CLUSTER_ZOOM_DETAIL - CLUSTER_ZOOM_OVERVIEW)),
    )
    return round(CLUSTER_DISTANCE_AT_16 + t * (CLUSTER_DISTANCE_AT_10 - CLUSTER_DISTANCE_AT_16))


def grid_gold_zoom_level(zoom: float) -> int | None:
    """Gold Parquet grid zoom level, or None when outside the precomputed band.

    Gold `grid_{z}` covers integer levels
    CLUSTER_MAX_ZOOM_THRESHOLD..CLUSTER_GRID_MAX_REFINE_ZOOM; deeper zooms reuse
    the last level (same cell size as grid_cell_size_m).
    """
    z = math.floor(zoom)
    if z < CLUSTER_MAX_ZOOM_THRESHOLD:
        return None
    return min(z, CLUSTER_GRID_MAX_REFINE_ZOOM)


def grid_cell_size_m(zoom: float) -> float:
    """Grid cell size in Web Mercator meters for the given map zoom.

    Halves per zoom step above the raw threshold (progressive cluster split).
    """
    z = math.floor(zoom)
    if z >= CLUSTER_MAX_ZOOM_THRESHOLD:
        cluster_zoom = min(z, CLUSTER_GRID_MAX_REFINE_ZOOM)
        return resolution_for_zoom(cluster_zoom) * cluster_distance_px(zoom)
    level = min(max(PRECOMPUTE_MIN_LEVEL, z), PRECOMPUTE_MAX_LEVEL)
    return resolution_for_zoom(level) * cluster_distance_px(level)


def mercator_to_lon_lat(x: float, y: float) -> tuple[float, float]:
    """Inverse Web Mercator (EPSG:3857 → EPSG:4326)."""
    lon = (x * 180.0) / _WEB_MERCATOR_HALF_CIRCUMFERENCE
    lat = (180.0 / math.pi) * (
        2.0 * math.atan(math.exp((y * math.pi) / _WEB_MERCATOR_HALF_CIRCUMFERENCE)) - math.pi / 2.0
    )
    return lon, lat
