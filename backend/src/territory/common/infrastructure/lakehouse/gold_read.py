"""Read gold cluster Parquet for lakehouse viewport (low/mid zoom)."""

from __future__ import annotations

import logging
import math
import threading
import time
from typing import Literal

from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.metrics import timed_op

AdminLevel = Literal["region", "province", "municipality", "sub_municipal"]

# Keep in sync with territory.assets...viewport_grid (avoid importing it — circular).
CLUSTER_MAX_ZOOM_THRESHOLD = 13
CLUSTER_GRID_MAX_REFINE_ZOOM = 18

logger = logging.getLogger(__name__)

_WEB_MERCATOR_HALF = 20037508.34

# Batch globs per DuckDB read (sequential per-file was multi-second at national scale).
_GOLD_READ_CHUNK = 100
# Warm cache for repeated national/regional pans at the same ingest set.
_GOLD_CACHE_TTL_SEC = 120.0
_gold_cache_lock = threading.Lock()
_gold_cache: dict[tuple[str, tuple], tuple[float, list[tuple]]] = {}

_GOLD_SELECT = """
SELECT level, region_id, province_id, municipality_id,
       cell_x, cell_y, count, sample_id,
       lon, lat, min_lon, min_lat, max_lon, max_lat
FROM read_parquet([{files}], union_by_name=true, hive_partitioning=false)
"""


def _lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * _WEB_MERCATOR_HALF / 180.0
    y = math.log(math.tan(math.radians(90.0 + lat) / 2.0)) * _WEB_MERCATOR_HALF / math.pi
    return x, y


def gold_prefix(resolution: IngestResolution, zoom_band: str) -> str:
    return (
        f"green_assets_clusters/region_id={resolution.region_id}/"
        f"province_id={resolution.province_id}/"
        f"municipality_id={resolution.municipality_id}/"
        f"ingest_date={resolution.ingest_at.isoformat()}/"
        f"zoom_band={zoom_band}"
    )


def _cache_key(
    resolutions: list[IngestResolution], zoom_band: str
) -> tuple[str, tuple]:
    fingerprint = tuple(
        sorted(
            (int(r.municipality_id), r.ingest_at.isoformat()) for r in resolutions
        )
    )
    return zoom_band, fingerprint


def _filter_rows_for_municipalities(
    rows: list[tuple], municipality_ids: set[int]
) -> list[tuple]:
    """Keep gold rows whose municipality_id is in the requested set."""
    if not municipality_ids:
        return []
    return [r for r in rows if int(r[3]) in municipality_ids]


def _lookup_gold_cache(
    resolutions: list[IngestResolution], zoom_band: str, now: float
) -> tuple[list[tuple] | None, str]:
    """Exact or subset cache hit.

    Zooming Italy→region used to miss when the pruned municipality set shrank
    by one id (forced a fresh multi-second MinIO read).
    """
    key = _cache_key(resolutions, zoom_band)
    with _gold_cache_lock:
        hit = _gold_cache.get(key)
        if hit is not None and (now - hit[0]) <= _GOLD_CACHE_TTL_SEC:
            return list(hit[1]), "exact"

        wanted = {int(r.municipality_id) for r in resolutions}
        best: tuple[float, list[tuple], int] | None = None
        for (band, fingerprint), (ts, rows) in _gold_cache.items():
            if band != zoom_band or (now - ts) > _GOLD_CACHE_TTL_SEC:
                continue
            cached_ids = {int(mid) for mid, _ingest in fingerprint}
            if not wanted <= cached_ids:
                continue
            if best is None or len(cached_ids) < best[2]:
                best = (ts, rows, len(cached_ids))
        if best is not None:
            return _filter_rows_for_municipalities(best[1], wanted), "subset"
    return None, "miss"


def _read_globs(con, globs: list[str]) -> list[tuple]:
    """Read gold parquet globs in chunks; fall back per-file if a chunk fails."""
    rows: list[tuple] = []
    for i in range(0, len(globs), _GOLD_READ_CHUNK):
        chunk = globs[i : i + _GOLD_READ_CHUNK]
        files_sql = ", ".join(f"'{g}'" for g in chunk)
        try:
            rows.extend(con.execute(_GOLD_SELECT.format(files=files_sql)).fetchall())
            continue
        except Exception as exc:
            logger.debug("gold chunk read failed (%s); falling back per file", exc)
        for glob in chunk:
            try:
                rows.extend(
                    con.execute(_GOLD_SELECT.format(files=f"'{glob}'")).fetchall()
                )
            except Exception as file_exc:
                logger.debug("gold missing or unreadable %s: %s", glob, file_exc)
    return rows


def _read_gold_rows(resolutions: list[IngestResolution], zoom_band: str) -> list[tuple]:
    """Read gold rows; skip municipalities whose gold part is missing."""
    if not resolutions:
        return []

    now = time.monotonic()
    cached, _hit_kind = _lookup_gold_cache(resolutions, zoom_band, now)
    if cached is not None:
        return cached

    key = _cache_key(resolutions, zoom_band)
    con = connect_lakehouse()
    try:
        with timed_op(
            "gold_read",
            zoom_band=zoom_band,
            municipalities=len(resolutions),
        ):
            globs = [
                parquet_glob(gold_prefix(resolution, zoom_band))
                for resolution in resolutions
            ]
            rows = _read_globs(con, globs)
    finally:
        con.close()

    with _gold_cache_lock:
        _gold_cache[key] = (time.monotonic(), rows)
        if len(_gold_cache) > 32:
            oldest = sorted(_gold_cache.items(), key=lambda kv: kv[1][0])[:8]
            for old_key, _ in oldest:
                _gold_cache.pop(old_key, None)
    return list(rows)


def _intersects_bbox(r: tuple, bbox: tuple[float, float, float, float]) -> bool:
    minx, miny, maxx, maxy = bbox
    lon, lat = float(r[8]), float(r[9])
    if minx <= lon <= maxx and miny <= lat <= maxy:
        return True
    return (
        float(r[10]) <= maxx
        and float(r[12]) >= minx
        and float(r[11]) <= maxy
        and float(r[13]) >= miny
    )


def _admin_region_uri(region_id: int) -> str:
    from core.config import settings

    return (
        f"s3://{settings.lakehouse_s3_bucket}/"
        f"green_assets_admin_clusters/region_id={region_id}/"
        f"part-municipality-bands.parquet"
    )


def _parse_ingest_at(value):
    from datetime import date as date_cls

    if isinstance(value, date_cls):
        return value
    return date_cls.fromisoformat(str(value)[:10])


def _read_admin_municipality_band_rows(
    resolutions: list[IngestResolution],
) -> list[tuple]:
    """Load municipality gold via consolidated per-region files when present.

    Falls back to legacy per-municipality globs for regions without a rollup part.
    """
    if not resolutions:
        return []

    # Reuse the same cache key as legacy municipality-band reads.
    cached, _hit_kind = _lookup_gold_cache(resolutions, "municipality", time.monotonic())
    if cached is not None:
        return cached

    wanted = {(int(r.municipality_id), r.ingest_at) for r in resolutions}
    by_region: dict[int, list[IngestResolution]] = {}
    for r in resolutions:
        by_region.setdefault(int(r.region_id), []).append(r)

    rows: list[tuple] = []
    legacy_resolutions: list[IngestResolution] = []
    con = connect_lakehouse()
    try:
        with timed_op(
            "gold_read_admin",
            zoom_band="municipality",
            municipalities=len(resolutions),
            regions=len(by_region),
        ):
            for region_id, region_res in by_region.items():
                uri = _admin_region_uri(region_id)
                try:
                    part = con.execute(
                        f"""
                        SELECT level, region_id, province_id, municipality_id,
                               cell_x, cell_y, count, sample_id,
                               lon, lat, min_lon, min_lat, max_lon, max_lat,
                               ingest_at
                        FROM read_parquet('{uri}', hive_partitioning=false)
                        """
                    ).fetchall()
                except Exception as exc:
                    logger.debug(
                        "admin gold missing region=%s (%s); legacy fallback",
                        region_id,
                        exc,
                    )
                    legacy_resolutions.extend(region_res)
                    continue
                for r in part:
                    mid = int(r[3])
                    ingest = _parse_ingest_at(r[14])
                    if (mid, ingest) not in wanted:
                        continue
                    rows.append(r[:14])
    finally:
        con.close()

    if legacy_resolutions:
        rows.extend(_read_gold_rows(legacy_resolutions, "municipality"))

    key = _cache_key(resolutions, "municipality")
    with _gold_cache_lock:
        _gold_cache[key] = (time.monotonic(), rows)
        if len(_gold_cache) > 32:
            oldest = sorted(_gold_cache.items(), key=lambda kv: kv[1][0])[:8]
            for old_key, _ in oldest:
                _gold_cache.pop(old_key, None)
    return list(rows)


def read_admin_clusters(
    resolutions: list[IngestResolution],
    level: AdminLevel,
    bbox: tuple[float, float, float, float],
) -> list[ViewportCluster]:
    """Roll up municipality gold bands to region/province/municipality."""
    rows = _read_admin_municipality_band_rows(resolutions)
    if not rows:
        return []

    buckets: dict[tuple, list[tuple]] = {}
    for r in rows:
        if not _intersects_bbox(r, bbox):
            continue
        region_id, province_id, municipality_id = int(r[1]), int(r[2]), int(r[3])
        if level == "region":
            key = ("region", region_id, None, None)
        elif level == "province":
            key = ("province", region_id, province_id, None)
        elif level == "municipality":
            key = ("municipality", region_id, province_id, municipality_id)
        else:
            continue
        buckets.setdefault(key, []).append(r)

    clusters: list[ViewportCluster] = []
    for key, members in buckets.items():
        level_name, region_id, province_id, municipality_id = key
        total = sum(int(m[6]) for m in members)
        sample_id = int(members[0][7])
        lon = sum(float(m[8]) for m in members) / len(members)
        lat = sum(float(m[9]) for m in members) / len(members)
        bbox_out = (
            min(float(m[10]) for m in members),
            min(float(m[11]) for m in members),
            max(float(m[12]) for m in members),
            max(float(m[13]) for m in members),
        )
        key_parts = [str(p) for p in (region_id, province_id, municipality_id) if p is not None]
        clusters.append(
            ViewportCluster(
                cell_x=0,
                cell_y=0,
                count=total,
                merc_x=0.0,
                merc_y=0.0,
                bbox=bbox_out,
                sample_id=sample_id,
                admin_key=f"{level_name[0].upper()}{'_'.join(key_parts)}",
                lon=lon,
                lat=lat,
            )
        )
    return clusters


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
