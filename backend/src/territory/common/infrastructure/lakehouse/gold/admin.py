"""Admin gold bands and region/province/municipality cluster rollup."""

from __future__ import annotations

import logging
import time

from territory.assets.infrastructure.repository.viewport_cluster import ViewportCluster
from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse
from territory.common.infrastructure.lakehouse.gold.cache import (
    _lookup_gold_cache,
    _store_gold_cache,
)
from territory.common.infrastructure.lakehouse.gold.constants import (
    _AREAS_STATS_CACHE_BAND,
    AdminLevel,
)
from territory.common.infrastructure.lakehouse.gold.io import (
    _read_areas_stats_muni_rows,
    _read_gold_rows,
)
from territory.common.infrastructure.lakehouse.gold.paths import (
    _admin_areas_stats_region_uri,
    _admin_region_uri,
)
from territory.common.infrastructure.lakehouse.metrics import timed_op

logger = logging.getLogger(__name__)


def _parse_ingest_at(value):
    from datetime import date as date_cls

    if isinstance(value, date_cls):
        return value
    return date_cls.fromisoformat(str(value)[:10])


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


def _bbox_intersects(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> bool:
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


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
                matched = 0
                for r in part:
                    mid = int(r[3])
                    ingest = _parse_ingest_at(r[14])
                    if (mid, ingest) not in wanted:
                        continue
                    rows.append(r[:14])
                    matched += 1
                # Consolidated rollup may only hold the latest national ingest.
                # Older snapshot dates still live under per-municipality gold —
                # fall back when the rollup has no row for this date window.
                if matched == 0:
                    legacy_resolutions.extend(region_res)
    finally:
        con.close()

    if legacy_resolutions:
        rows.extend(_read_gold_rows(legacy_resolutions, "municipality"))

    _store_gold_cache(resolutions, "municipality", rows)
    return list(rows)


def _read_admin_areas_stats_band_rows(
    resolutions: list[IngestResolution],
) -> list[tuple]:
    """Load areas root-count stats via consolidated per-region files when present.

    Falls back to per-municipality ``green_areas_stats`` globs.
    """
    if not resolutions:
        return []

    cached, _hit_kind = _lookup_gold_cache(
        resolutions, _AREAS_STATS_CACHE_BAND, time.monotonic()
    )
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
            "areas_stats_read_admin",
            zoom_band="municipality",
            municipalities=len(resolutions),
            regions=len(by_region),
        ):
            for region_id, region_res in by_region.items():
                uri = _admin_areas_stats_region_uri(region_id)
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
                        "admin areas_stats missing region=%s (%s); legacy fallback",
                        region_id,
                        exc,
                    )
                    legacy_resolutions.extend(region_res)
                    continue
                matched = 0
                for r in part:
                    mid = int(r[3])
                    ingest = _parse_ingest_at(r[14])
                    if (mid, ingest) not in wanted:
                        continue
                    rows.append(r[:14])
                    matched += 1
                if matched == 0:
                    legacy_resolutions.extend(region_res)
    finally:
        con.close()

    if legacy_resolutions:
        rows.extend(_read_areas_stats_muni_rows(legacy_resolutions))

    _store_gold_cache(resolutions, _AREAS_STATS_CACHE_BAND, rows)
    return list(rows)


def read_admin_clusters(
    resolutions: list[IngestResolution],
    level: AdminLevel,
    bbox: tuple[float, float, float, float],
) -> list[ViewportCluster]:
    """Roll up municipality gold bands to region/province/municipality.

    Region/province counts are always the full unit total (all member rows in
    ``resolutions``). Visibility still follows the viewport: emit the unit when
    its aggregated extent intersects ``bbox``. Municipality markers stay
    bbox-filtered per row.
    """
    rows = _read_admin_municipality_band_rows(resolutions)
    if not rows:
        return []

    buckets: dict[tuple, list[tuple]] = {}
    for r in rows:
        region_id, province_id, municipality_id = int(r[1]), int(r[2]), int(r[3])
        if level == "region":
            key = ("region", region_id, None, None)
        elif level == "province":
            key = ("province", region_id, province_id, None)
        elif level == "municipality":
            if not _intersects_bbox(r, bbox):
                continue
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
        if level in {"region", "province"} and not _bbox_intersects(bbox_out, bbox):
            # Unit extent outside the view — skip (count stays full when shown).
            if not any(_intersects_bbox(m, bbox) for m in members):
                continue
        key_parts = [
            str(p) for p in (region_id, province_id, municipality_id) if p is not None
        ]
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
