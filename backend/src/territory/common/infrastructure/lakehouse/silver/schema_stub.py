"""Schema stub parquet (zero rows, V1.1 schema) for union_by_name with old parts."""

from __future__ import annotations

import os
import tempfile
import threading
from typing import Literal

_SCHEMA_STUB_LOCK = threading.Lock()
_SCHEMA_STUB_PATHS: dict[str, str] = {}


def _schema_stub_path(kind: Literal["assets", "areas"]) -> str:
    """Zero-row Parquet with full V1.1 schema so union_by_name fills missing cols.

    Older municipality parts lack V1.1 columns; SELECT species_code/zril_* on a
    single file raises BinderException. Prepending this stub makes DuckDB treat
    missing columns as NULL without rewriting every silver part.
    """
    cached = _SCHEMA_STUB_PATHS.get(kind)
    if cached is not None:
        return cached
    with _SCHEMA_STUB_LOCK:
        cached = _SCHEMA_STUB_PATHS.get(kind)
        if cached is not None:
            return cached

        from territory.common.infrastructure.lakehouse.duckdb_client import (
            connect_lakehouse,
        )

        path = os.path.join(
            tempfile.gettempdir(), f"cadastre_silver_stub_{kind}.parquet"
        )
        if kind == "assets":
            cols_sql = """
                CAST(NULL AS BIGINT) AS id,
                CAST(NULL AS BIGINT) AS green_area_id,
                CAST(NULL AS INTEGER) AS region_id,
                CAST(NULL AS INTEGER) AS province_id,
                CAST(NULL AS INTEGER) AS municipality_id,
                CAST(NULL AS DATE) AS ingest_date,
                CAST(NULL AS VARCHAR) AS asset_type,
                CAST(NULL AS VARCHAR) AS geometry_type,
                CAST(NULL AS DOUBLE) AS lon,
                CAST(NULL AS DOUBLE) AS lat,
                CAST(NULL AS BLOB) AS geom_wkb,
                CAST(NULL AS VARCHAR) AS species,
                CAST(NULL AS VARCHAR) AS family,
                CAST(NULL AS VARCHAR) AS genus,
                CAST(NULL AS VARCHAR) AS variety,
                CAST(NULL AS VARCHAR) AS health_status,
                CAST(NULL AS VARCHAR) AS asset_status,
                CAST(NULL AS TIMESTAMPTZ) AS survey_date,
                CAST(NULL AS VARCHAR) AS species_code,
                CAST(NULL AS DOUBLE) AS trunk_diameter_cm,
                CAST(NULL AS DOUBLE) AS plant_height_m,
                CAST(NULL AS DOUBLE) AS crown_diameter_cm,
                CAST(NULL AS VARCHAR) AS growth_stage,
                CAST(NULL AS VARCHAR) AS protection_status
            """
        else:
            cols_sql = """
                CAST(NULL AS BIGINT) AS id,
                CAST(NULL AS INTEGER) AS region_id,
                CAST(NULL AS INTEGER) AS province_id,
                CAST(NULL AS INTEGER) AS municipality_id,
                CAST(NULL AS DATE) AS ingest_date,
                CAST(NULL AS BIGINT) AS parent_id,
                CAST(NULL AS INTEGER) AS level,
                CAST(NULL AS VARCHAR) AS name,
                CAST(NULL AS DOUBLE) AS lon,
                CAST(NULL AS DOUBLE) AS lat,
                CAST(NULL AS BLOB) AS geom_wkb,
                CAST(NULL AS VARCHAR) AS area_classification,
                CAST(NULL AS VARCHAR) AS administrative_status,
                CAST(NULL AS TIMESTAMPTZ) AS survey_date,
                CAST(NULL AS VARCHAR) AS zril_identifier,
                CAST(NULL AS VARCHAR) AS istat_classification,
                CAST(NULL AS VARCHAR) AS intensity_of_fruition,
                CAST(NULL AS VARCHAR) AS perimeter_type,
                CAST(NULL AS DOUBLE) AS surface_area_m2
            """
        con = connect_lakehouse()
        try:
            con.execute(
                f"COPY (SELECT {cols_sql} WHERE FALSE) TO '{path}' (FORMAT PARQUET)"
            )
        finally:
            con.close()
        _SCHEMA_STUB_PATHS[kind] = path
        return path
