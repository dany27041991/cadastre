"""DuckDB reads of gold / areas-stats Parquet globs."""

from __future__ import annotations

import logging
import time

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)
from territory.common.infrastructure.lakehouse.gold.cache import (
    _lookup_gold_cache,
    _store_gold_cache,
)
from territory.common.infrastructure.lakehouse.gold.constants import (
    _AREAS_STATS_CACHE_BAND,
    _GOLD_READ_CHUNK,
    _GOLD_SELECT,
)
from territory.common.infrastructure.lakehouse.gold.paths import (
    areas_stats_prefix,
    gold_prefix,
)
from territory.common.infrastructure.lakehouse.metrics import timed_op

logger = logging.getLogger(__name__)


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

    _store_gold_cache(resolutions, zoom_band, rows)
    return list(rows)


def _read_areas_stats_muni_rows(resolutions: list[IngestResolution]) -> list[tuple]:
    """Read per-municipality green_areas_stats bands (legacy path without admin rollup)."""
    if not resolutions:
        return []

    now = time.monotonic()
    cached, _hit_kind = _lookup_gold_cache(resolutions, _AREAS_STATS_CACHE_BAND, now)
    if cached is not None:
        return cached

    con = connect_lakehouse()
    try:
        with timed_op(
            "areas_stats_read",
            zoom_band="municipality",
            municipalities=len(resolutions),
        ):
            globs = [
                parquet_glob(areas_stats_prefix(resolution, "municipality"))
                for resolution in resolutions
            ]
            rows = _read_globs(con, globs)
    finally:
        con.close()

    _store_gold_cache(resolutions, _AREAS_STATS_CACHE_BAND, rows)
    return list(rows)
