"""Functions for reading viewport clusters and aggregates."""

from __future__ import annotations

import hashlib
import logging
import math
import threading
import time
from typing import TYPE_CHECKING, Any

from cachetools import TTLCache

from territory.assets.infrastructure.mapper import build_green_asset_feature_collection
from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse import gold_read, silver_read
from territory.common.infrastructure.lakehouse.gold_read import (
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
)
from territory.common.infrastructure.lakehouse.silver.bounded_cache import (
    filter_cache_key,
)
from territory.geo.domain.entities import GeoJSONFeatureCollection

if TYPE_CHECKING:
    from collections.abc import Callable
    from datetime import date

    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_EMPTY_FC: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}

# Live FK clusters are expensive cold (~786ms) but stable for a Cerca scope;
# cache across zoom/pan within the same area-id set (debug 4fe799 perf-opt).
_LIVE_GA_CACHE_TTL_SEC = 60.0
_LIVE_GA_CACHE_MAX = 64
_live_ga_lock = threading.Lock()
_live_ga_cache: TTLCache = TTLCache(maxsize=_LIVE_GA_CACHE_MAX, ttl=_LIVE_GA_CACHE_TTL_SEC)

# Mirror viewport_grid.grid_cell_size_m for live-grid → gold band mapping (no app-layer import).
_WEB_MERCATOR_BASE = 156543.03392804097
_GRID_REF_LAT = 41.9
_CLUSTER_DISTANCE_AT_16 = 80.0

def _grid_cell_size_m(zoom: float) -> float:
    z = min(max(int(zoom), CLUSTER_MAX_ZOOM_THRESHOLD), CLUSTER_GRID_MAX_REFINE_ZOOM)
    scale = _WEB_MERCATOR_BASE * math.cos(math.radians(_GRID_REF_LAT))
    return (scale / 2**z) * _CLUSTER_DISTANCE_AT_16

def _zoom_level_for_cell_size(cell_size_m: float) -> int:
    """Best-effort map of live-grid cell size back to a gold zoom band."""
    best_z = CLUSTER_MAX_ZOOM_THRESHOLD
    best_delta = float("inf")
    for z in range(CLUSTER_MAX_ZOOM_THRESHOLD, CLUSTER_GRID_MAX_REFINE_ZOOM + 1):
        delta = abs(_grid_cell_size_m(float(z)) - cell_size_m)
        if delta < best_delta:
            best_delta = delta
            best_z = z
    return best_z

def exact_clusters_for_clip(
    session_factory: Callable[[], Session],
    date_from: date | None,
    date_to: date | None,
    *,
    clip_wkt: str,
    mode: str,
    bbox: tuple[float, float, float, float],
    cell_size_m: float | None = None,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
) -> list[ViewportCluster] | None:
    """Return exact clusters, empty list if over-cap, or None to fall back to gold."""
    from core.config import settings
    from territory.common.infrastructure.lakehouse import clip_exact, clip_exact_flag

    clip_geom = silver_read._parse_clip_geom(clip_wkt)
    if clip_geom is None:
        return None
    with session_factory() as session:
        decision = clip_exact.evaluate_clip_exact_cap(
            session,
            clip_geom,
            clip_wkt,
            max_municipalities=settings.clip_exact_max_municipalities,
            max_km2=settings.clip_exact_max_km2,
            enabled=settings.clip_exact_clusters_enabled,
        )
    if not decision.eligible:
        clip_exact_flag.mark_cluster_over_cap()
        logger.info(
            "clip_exact over_cap reason=%s km2=%.1f",
            decision.reason,
            decision.km2,
        )
        return []
    if not decision.municipality_ids:
        return []
    from territory.common.infrastructure.lakehouse.catalog import resolve_latest_ingests

    if date_from is None or date_to is None:
        return []
    resolutions = resolve_latest_ingests(
        dataset="assets",
        date_from=date_from,
        date_to=date_to,
        municipality_ids=list(decision.municipality_ids),
    )
    if region_id is not None:
        resolutions = [r for r in resolutions if r.region_id == region_id]
    if province_id is not None:
        resolutions = [r for r in resolutions if r.province_id == province_id]
    if municipality_id is not None:
        resolutions = [r for r in resolutions if r.municipality_id == municipality_id]
    if not resolutions:
        return []
    return silver_read.aggregate_assets_in_clip(
        resolutions,
        clip_geom,
        mode=mode,  # type: ignore[arg-type]
        cell_size_m=cell_size_m,
        view_bbox=bbox,
    )

def get_admin_clusters_in_bbox(
    session_factory: Callable[[], Session],
    resolutions_callback,
    date_from: date | None,
    date_to: date | None,
    level: str,
    bbox: tuple[float, float, float, float],
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = None,
    municipality_ids: list[int] | None = None,
) -> list[ViewportCluster]:
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        filter_clusters_by_clip,
        municipality_ids_for_view,
        resolve_clip_geom,
    )

    # V1 gold has municipality bands only; sub_municipal falls through to grid.
    if level == "sub_municipal":
        return []
    if clip_wkt:
        # Draw clip: exact municipality counts inside polygon (soft-capped).
        exact = exact_clusters_for_clip(
            session_factory,
            date_from,
            date_to,
            clip_wkt=clip_wkt,
            mode="municipality",
            bbox=bbox,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if exact is not None:
            return exact
    view_muni_ids = municipality_ids_for_view(
        session_factory,
        resolutions_callback,
        bbox=bbox,
        clip_wkt=None,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
    )
    if municipality_ids is not None:
        allowed = {int(m) for m in municipality_ids}
        if view_muni_ids is not None:
            view_muni_ids = [m for m in view_muni_ids if int(m) in allowed]
        elif municipality_id is None:
            view_muni_ids = sorted(allowed)
        if not view_muni_ids and municipality_id is None:
            return []
    if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
        return []
    # Region/province markers keep the full admin total unless an explicit
    # municipality_ids allowlist scopes the rollup (filtered search).
    # Viewport-only filtering used to shrink counts on pan (e.g. P16_75).
    if level in {"region", "province"}:
        resolutions = resolutions_callback(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=municipality_ids,
        )
    else:
        resolutions = resolutions_callback(
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
            municipality_ids=view_muni_ids,
        )
    if not resolutions:
        return []
    clusters = gold_read.read_admin_clusters(resolutions, level, bbox)  # type: ignore[arg-type]
    clip_geom = resolve_clip_geom(
        session_factory,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=clip_wkt,
    )
    # Missing sub-municipal geom → empty; plain None clip → no filter.
    if sub_municipal_area_id is not None and clip_geom is None:
        return []
    return filter_clusters_by_clip(clusters, clip_geom)

def get_raw_in_bbox(
    session_factory: Callable[[], Session],
    resolutions_callback,
    bbox: tuple[float, float, float, float],
    limit: int,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    green_area_ids: list[int] | None = None,
    municipality_ids: list[int] | None = None,
    clip_wkt: str | None = None,
    filters: dict[str, Any] | None = None,
    clip_geom=None,
) -> GeoJSONFeatureCollection:
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        municipality_ids_for_view,
        resolve_clip_geom,
    )

    if green_area_ids is not None and not green_area_ids:
        return _EMPTY_FC
    view_muni_ids = municipality_ids_for_view(
        session_factory,
        resolutions_callback,
        bbox=bbox,
        clip_wkt=clip_wkt,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
    )
    if municipality_ids is not None:
        allowed = set(int(m) for m in municipality_ids)
        if view_muni_ids is not None:
            view_muni_ids = [m for m in view_muni_ids if int(m) in allowed]
        elif municipality_id is None:
            view_muni_ids = list(allowed)
        if not view_muni_ids and municipality_id is None:
            return _EMPTY_FC
    if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
        return _EMPTY_FC
    resolutions = resolutions_callback(
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        municipality_ids=view_muni_ids,
    )
    if not resolutions:
        return _EMPTY_FC
    effective_clip = clip_geom
    resolved = resolve_clip_geom(
        session_factory,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=clip_wkt,
    )
    if resolved is not None and effective_clip is not None:
        inter = resolved.intersection(effective_clip)
        effective_clip = None if inter.is_empty else inter
    elif resolved is not None:
        effective_clip = resolved
    if sub_municipal_area_id is not None and effective_clip is None:
        return _EMPTY_FC
    rows = silver_read.read_assets_in_bbox(
        resolutions,
        bbox,
        limit,
        green_area_id=green_area_id,
        green_area_ids=green_area_ids,
        clip_geom=effective_clip,
        filters=filters,
    )
    if not rows:
        return _EMPTY_FC
    return build_green_asset_feature_collection(rows)

def get_grid_clusters_from_gold(
    session_factory: Callable[[], Session],
    resolutions_callback,
    date_from: date | None,
    date_to: date | None,
    zoom_level: int,
    bbox: tuple[float, float, float, float],
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    clip_wkt: str | None = None,
    municipality_ids: list[int] | None = None,
) -> list[ViewportCluster]:
    """Pre-aggregated grid clusters from gold Parquet (`grid_{zoom_level}`)."""
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        filter_clusters_by_clip,
        municipality_ids_for_view,
    )

    if clip_wkt:
        exact = exact_clusters_for_clip(
            session_factory,
            date_from,
            date_to,
            clip_wkt=clip_wkt,
            mode="grid",
            bbox=bbox,
            cell_size_m=_grid_cell_size_m(float(zoom_level)),
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if exact is not None:
            return exact
    view_muni_ids = municipality_ids_for_view(
        session_factory,
        resolutions_callback,
        bbox=bbox,
        clip_wkt=None,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
    )
    if municipality_ids is not None:
        allowed = {int(m) for m in municipality_ids}
        if view_muni_ids is not None:
            view_muni_ids = [m for m in view_muni_ids if int(m) in allowed]
        elif municipality_id is None:
            view_muni_ids = sorted(allowed)
        if not view_muni_ids and municipality_id is None:
            return []
    if municipality_id is None and view_muni_ids is not None and not view_muni_ids:
        return []
    resolutions = resolutions_callback(
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        municipality_ids=view_muni_ids,
    )
    if not resolutions:
        return []
    clusters = gold_read.read_grid_clusters(resolutions, zoom_level, bbox)
    clip_geom = silver_read._parse_clip_geom(clip_wkt)
    return filter_clusters_by_clip(clusters, clip_geom)

_WORLD_BBOX: tuple[float, float, float, float] = (-180.0, -90.0, 180.0, 90.0)

def _live_ga_cache_key(
    green_area_ids: list[int],
    *,
    cell_size_m: float,
    municipality_ids: list[int] | None,
    filters: dict[str, Any] | None,
    has_clip: bool,
) -> tuple:
    """Key omits view bbox — store full ga-id clusters, filter bbox on read.

    Debug 4fe799: bbox-in-key → 0 cache hits on pan/zoom; cold paid 430–869ms
    every time. cell_size still tracks zoom band.
    """
    ids = tuple(sorted(int(x) for x in green_area_ids))
    ids_part: Any = ids
    if len(ids) > 128:
        ids_part = hashlib.sha1(",".join(map(str, ids)).encode()).hexdigest()
    munis = tuple(sorted(int(m) for m in (municipality_ids or [])))
    if len(munis) > 64:
        munis = (hashlib.sha1(",".join(map(str, munis)).encode()).hexdigest(),)
    return (
        ids_part,
        round(float(cell_size_m), 1),
        munis,
        filter_cache_key(filters or {}),
        bool(has_clip),
    )

def _filter_clusters_by_view_bbox(
    clusters: list[ViewportCluster],
    bbox: tuple[float, float, float, float],
) -> list[ViewportCluster]:
    minx, miny, maxx, maxy = bbox
    out: list[ViewportCluster] = []
    for c in clusters:
        cx0, cy0, cx1, cy1 = c.bbox
        if cx1 < minx or cx0 > maxx or cy1 < miny or cy0 > maxy:
            continue
        out.append(c)
    return out

def get_clusters_for_green_area_ids(
    session_factory: Callable[[], Session],
    resolutions_callback,
    bbox: tuple[float, float, float, float],
    cell_size_m: float,
    green_area_ids: list[int],
    *,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    municipality_ids: list[int] | None = None,
    clip_wkt: str | None = None,
    clip_geom=None,
    filters: dict[str, Any] | None = None,
) -> list[ViewportCluster]:
    """Live grid clusters for Cerca-scoped green_area_ids (FK ± area geom clip)."""
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        resolve_clip_geom,
    )

    if not green_area_ids:
        return []
    has_clip = bool(clip_wkt) or clip_geom is not None
    cache_key = _live_ga_cache_key(
        green_area_ids,
        cell_size_m=cell_size_m,
        municipality_ids=municipality_ids,
        filters=filters,
        has_clip=has_clip,
    )
    with _live_ga_lock:
        hit = _live_ga_cache.get(cache_key)
        if hit is not None:
            filtered = _filter_clusters_by_view_bbox(list(hit), bbox)
            return filtered

    resolutions = resolutions_callback(
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
        municipality_ids=municipality_ids,
    )
    if not resolutions:
        return []
    effective_clip = clip_geom
    if clip_wkt:
        draw_clip = resolve_clip_geom(
            session_factory,
            municipality_id=municipality_id,
            sub_municipal_area_id=None,
            clip_wkt=clip_wkt,
        )
        if draw_clip is not None and effective_clip is not None:
            inter = draw_clip.intersection(effective_clip)
            effective_clip = None if inter.is_empty else inter
        elif draw_clip is not None:
            effective_clip = draw_clip
    t0 = time.monotonic()
    # Aggregate without view clip so pan at same cell_size reuses cache.
    clusters_full = silver_read.aggregate_assets_by_green_area_ids(
        resolutions,
        green_area_ids,
        cell_size_m=cell_size_m,
        view_bbox=_WORLD_BBOX,
        clip_geom=effective_clip,
        filters=filters,
    )
    ms = int((time.monotonic() - t0) * 1000)
    with _live_ga_lock:
        _live_ga_cache[cache_key] = list(clusters_full)
    filtered = _filter_clusters_by_view_bbox(clusters_full, bbox)
    return filtered

def get_clusters_in_bbox(
    session_factory: Callable[[], Session],
    resolutions_callback,
    date_from: date | None,
    date_to: date | None,
    bbox: tuple[float, float, float, float],
    cell_size_m: float,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    clip_wkt: str | None = None,
) -> list[ViewportCluster]:
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        filter_clusters_by_clip,
        resolve_clip_geom,
    )

    # Live-grid scopes: gold band + geometric clip/sub-municipal filter.
    clip_geom = resolve_clip_geom(
        session_factory,
        municipality_id=municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=clip_wkt,
    )
    if sub_municipal_area_id is not None and clip_geom is None:
        return []

    # Sub-municipal (and draw∩sub) must use exact silver∩clip: pre-aggregated
    # gold cells filtered by sample-point leak markers outside the quartiere.
    if sub_municipal_area_id is not None and clip_geom is not None:
        exact = exact_clusters_for_clip(
            session_factory,
            date_from,
            date_to,
            clip_wkt=clip_geom.wkt,
            mode="grid",
            bbox=bbox,
            cell_size_m=cell_size_m,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if exact is not None:
            return exact

    if clip_wkt and sub_municipal_area_id is None and green_area_id is None:
        exact = exact_clusters_for_clip(
            session_factory,
            date_from,
            date_to,
            clip_wkt=clip_wkt,
            mode="grid",
            bbox=bbox,
            cell_size_m=cell_size_m,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        if exact is not None:
            return exact
    resolutions = resolutions_callback(
        region_id=region_id,
        province_id=province_id,
        municipality_id=municipality_id,
    )
    if not resolutions:
        return []
    clusters = gold_read.read_grid_clusters(
        resolutions,
        _zoom_level_for_cell_size(cell_size_m),
        bbox,
    )
    # green_area_id not applied on gold aggregates (no per-asset join in V1).
    _ = green_area_id
    return filter_clusters_by_clip(clusters, clip_geom)
