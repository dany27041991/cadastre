"""Façade: gold cluster Parquet reads for lakehouse viewport (low/mid zoom).

Implementation lives under ``lakehouse.gold``; this module re-exports the public
and semi-public API so existing ``gold_read.*`` imports stay stable.
"""

from __future__ import annotations

from territory.common.infrastructure.lakehouse.gold.admin import (
    _read_admin_areas_stats_band_rows,
    _read_admin_municipality_band_rows,
    read_admin_clusters,
)
from territory.common.infrastructure.lakehouse.gold.cache import (
    _gold_cache,
    _gold_cache_lock,
    invalidate_gold_cache,
)
from territory.common.infrastructure.lakehouse.gold.constants import (
    CLUSTER_GRID_MAX_REFINE_ZOOM,
    CLUSTER_MAX_ZOOM_THRESHOLD,
    AdminLevel,
)
from territory.common.infrastructure.lakehouse.gold.grid import read_grid_clusters
from territory.common.infrastructure.lakehouse.gold.io import (
    _read_areas_stats_muni_rows,
    _read_gold_rows,
)
from territory.common.infrastructure.lakehouse.gold.paths import (
    areas_stats_prefix,
    gold_prefix,
)

__all__ = [
    "AdminLevel",
    "CLUSTER_GRID_MAX_REFINE_ZOOM",
    "CLUSTER_MAX_ZOOM_THRESHOLD",
    "areas_stats_prefix",
    "gold_prefix",
    "invalidate_gold_cache",
    "read_admin_clusters",
    "read_grid_clusters",
    "_read_admin_areas_stats_band_rows",
    "_read_admin_municipality_band_rows",
    "_read_areas_stats_muni_rows",
    "_read_gold_rows",
    "_gold_cache",
    "_gold_cache_lock",
]
