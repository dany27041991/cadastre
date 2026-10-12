"""Shared constants for gold lakehouse reads."""

from __future__ import annotations

from typing import Literal

AdminLevel = Literal["region", "province", "municipality", "sub_municipal"]

# Keep in sync with territory.assets...viewport_grid (avoid importing it — circular).
CLUSTER_MAX_ZOOM_THRESHOLD = 13
CLUSTER_GRID_MAX_REFINE_ZOOM = 18

_WEB_MERCATOR_HALF = 20037508.34

# Batch globs per DuckDB read (sequential per-file was multi-second at national scale).
_GOLD_READ_CHUNK = 100

# Warm cache for repeated national/regional pans at the same ingest set.
_GOLD_CACHE_TTL_SEC = 120.0

# Cache band key for areas-stats municipality rows (must not collide with asset gold).
_AREAS_STATS_CACHE_BAND = "areas_stats_municipality"

_GOLD_SELECT = """
SELECT level, region_id, province_id, municipality_id,
       cell_x, cell_y, count, sample_id,
       lon, lat, min_lon, min_lat, max_lon, max_lat
FROM read_parquet([{files}], union_by_name=true, hive_partitioning=false)
"""
