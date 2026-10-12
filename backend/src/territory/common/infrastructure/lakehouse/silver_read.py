"""DuckDB reads against lakehouse silver Parquet (assets / areas).

This module is a façade that re-exports functions from silver.* submodules.
"""

from __future__ import annotations

from territory.common.infrastructure.lakehouse.duckdb_client import (
    connect_lakehouse,
    parquet_glob,
)

# Import leaf modules and re-export for backward compatibility (monkeypatch, tests)
from .silver.allowlist import (
    _allowlist_lock,
    _allowlist_mid_cache,
    _gold_presence_where,
    _is_areas_roots_only_where,
    _muni_counts_from_gold,
    _non_stub_allowlist,
)
from .silver.areas_bbox import read_area_by_pk, read_areas_in_bbox
from .silver.areas_catalog import (
    read_area_roots,
    read_area_roots_intersecting_clip,
    read_area_roots_intersecting_geom,
    read_areas_by_parent,
    read_areas_contained_or_intersecting,
    union_geom_for_area_ids,
)
from .silver.areas_table import list_areas_table
from .silver.assets_bbox import read_asset_by_pk, read_assets_in_bbox
from .silver.assets_catalog import read_assets_catalog, read_assets_intersecting_geom
from .silver.assets_table import list_assets_table
from .silver.clusters import (
    aggregate_assets_by_green_area_ids,
    aggregate_assets_in_clip,
)
from .silver.constants import (
    _ALLOWLIST_TTL_SEC,
    _FILTER_DENSE_FLOOR,
    _TABLE_COUNT_CHUNK,
    _TABLE_COUNT_TTL_SEC,
    _TABLE_SINGLE_SHOT_MAX,
    _TABLE_WIDE_CHUNK,
)
from .silver.counts import (
    _area_total_from_gold,
    _asset_total_from_gold,
    _count_cache_get,
    _resolve_wide_total,
    _schedule_wide_count,
    _table_count_cache,
    _table_count_inflight,
    _table_count_lock,
    _wide_count,
)
from .silver.geom import (
    _parse_clip_geom,
    _wkb_to_geojson,
    read_asset_bbox,
    read_asset_geometry,
)
from .silver.matching_areas import (
    resolve_matching_areas,
    resolve_matching_municipality_ids,
)
from .silver.resolve import DatasetName, resolve_prefixes
from .silver.schema_stub import _SCHEMA_STUB_LOCK, _SCHEMA_STUB_PATHS, _schema_stub_path
from .silver.sql import (
    _files_sql_for,
    _green_area_id_in_sql,
    _has_more_total,
    _id_in_sql,
    _resolutions_fingerprint,
)
from .silver.wide_select import _wide_select_rows

__all__ = [
    "DatasetName",
    "resolve_prefixes",
    "_wkb_to_geojson",
    "read_asset_geometry",
    "read_asset_bbox",
    "_parse_clip_geom",
    "_id_in_sql",
    "_green_area_id_in_sql",
    "_files_sql_for",
    "_resolutions_fingerprint",
    "_has_more_total",
    "_SCHEMA_STUB_LOCK",
    "_SCHEMA_STUB_PATHS",
    "_schema_stub_path",
    "_TABLE_SINGLE_SHOT_MAX",
    "_TABLE_WIDE_CHUNK",
    "_TABLE_COUNT_CHUNK",
    "_TABLE_COUNT_TTL_SEC",
    "_FILTER_DENSE_FLOOR",
    "_ALLOWLIST_TTL_SEC",
    "read_assets_in_bbox",
    "read_asset_by_pk",
    "resolve_matching_areas",
    "resolve_matching_municipality_ids",
    "list_assets_table",
    "read_areas_in_bbox",
    "read_area_by_pk",
    "list_areas_table",
    "read_area_roots",
    "read_areas_by_parent",
    "read_area_roots_intersecting_geom",
    "read_area_roots_intersecting_clip",
    "read_areas_contained_or_intersecting",
    "union_geom_for_area_ids",
    "read_assets_catalog",
    "read_assets_intersecting_geom",
    "aggregate_assets_in_clip",
    "aggregate_assets_by_green_area_ids",
    # Re-export for tests and monkeypatching
    "connect_lakehouse",
    "parquet_glob",
    "_allowlist_lock",
    "_allowlist_mid_cache",
    "_gold_presence_where",
    "_is_areas_roots_only_where",
    "_muni_counts_from_gold",
    "_non_stub_allowlist",
    "_area_total_from_gold",
    "_asset_total_from_gold",
    "_count_cache_get",
    "_resolve_wide_total",
    "_schedule_wide_count",
    "_table_count_cache",
    "_table_count_inflight",
    "_table_count_lock",
    "_wide_count",
    "_wide_select_rows",
]
