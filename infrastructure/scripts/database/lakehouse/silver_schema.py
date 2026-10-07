"""Canonical silver Parquet column sets for green areas / assets (V1.1 filter-ready).

Writers should emit these columns. ``ensure_*_table`` backfills missing fields with
nulls so older builders stay compatible during rollout.
"""

from __future__ import annotations

from typing import Any

import pyarrow as pa

# Product filter keys (FE) rely on these physical columns — see
# docs/design/2026-10-07-green-filters-cerca-map-table-design.md

AREA_COLUMN_TYPES: dict[str, pa.DataType] = {
    "id": pa.int64(),
    "region_id": pa.int32(),
    "province_id": pa.int32(),
    "municipality_id": pa.int32(),
    "ingest_date": pa.date32(),
    "parent_id": pa.int64(),
    "level": pa.int32(),
    "name": pa.string(),
    "lon": pa.float64(),
    "lat": pa.float64(),
    "geom_wkb": pa.binary(),
    "area_classification": pa.string(),
    "administrative_status": pa.string(),
    "survey_date": pa.timestamp("us", tz="UTC"),
    # V1.1 — table/map attribute filters
    "zril_identifier": pa.string(),
    "istat_classification": pa.string(),
    "intensity_of_fruition": pa.string(),
    "perimeter_type": pa.string(),
    "surface_area_m2": pa.float64(),
}

ASSET_COLUMN_TYPES: dict[str, pa.DataType] = {
    "id": pa.int64(),
    "green_area_id": pa.int64(),
    "region_id": pa.int32(),
    "province_id": pa.int32(),
    "municipality_id": pa.int32(),
    "ingest_date": pa.date32(),
    "asset_type": pa.string(),
    "geometry_type": pa.string(),
    "lon": pa.float64(),
    "lat": pa.float64(),
    "geom_wkb": pa.binary(),
    "species": pa.string(),
    "family": pa.string(),
    "genus": pa.string(),
    "variety": pa.string(),
    "health_status": pa.string(),
    "asset_status": pa.string(),
    "survey_date": pa.timestamp("us", tz="UTC"),
    # V1.1 — table/map attribute filters
    "species_code": pa.string(),
    "trunk_diameter_cm": pa.float64(),
    "plant_height_m": pa.float64(),
    "crown_diameter_m": pa.float64(),
    "growth_stage": pa.string(),
    "protection_status": pa.string(),
}


def _null_array(n: int, typ: pa.DataType) -> pa.Array:
    return pa.nulls(n, type=typ)


def ensure_table(table: pa.Table, column_types: dict[str, pa.DataType]) -> pa.Table:
    """Return table with all canonical columns (missing → null), in schema order."""
    n = table.num_rows
    arrays: list[pa.Array] = []
    names: list[str] = []
    for name, typ in column_types.items():
        names.append(name)
        if name in table.column_names:
            col = table.column(name)
            if col.type.equals(typ):
                arrays.append(col.combine_chunks() if hasattr(col, "combine_chunks") else col)
            else:
                try:
                    arrays.append(col.cast(typ, safe=False))
                except Exception:
                    arrays.append(_null_array(n, typ))
        else:
            arrays.append(_null_array(n, typ))
    return pa.table(arrays, names=names)


def ensure_areas_table(table: pa.Table) -> pa.Table:
    return ensure_table(table, AREA_COLUMN_TYPES)


def ensure_assets_table(table: pa.Table) -> pa.Table:
    return ensure_table(table, ASSET_COLUMN_TYPES)


def approx_surface_area_m2(geom: Any, lon: float | None, lat: float | None) -> float | None:
    """Rough geodesic area from WGS84 shapely geom (same spirit as clip_exact.approx_clip_km2)."""
    if geom is None:
        return None
    try:
        import math

        if geom.is_empty:
            return None
        lat0 = float(lat) if lat is not None else float(geom.centroid.y)
        lon0 = float(lon) if lon is not None else float(geom.centroid.x)
        _ = lon0
        m2 = float(geom.area) * (111_320.0**2) * abs(math.cos(math.radians(lat0)))
        if m2 <= 0 or math.isnan(m2):
            return None
        return m2
    except Exception:
        return None
