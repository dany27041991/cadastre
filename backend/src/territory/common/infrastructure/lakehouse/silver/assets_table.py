"""List assets in table format."""

from __future__ import annotations

from typing import Any

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse
from territory.common.infrastructure.lakehouse.filter_test_log import emit_filter_test_log
from territory.common.infrastructure.lakehouse.table_filters import asset_filter_where

from .constants import _TABLE_SINGLE_SHOT_MAX
from .sql import _id_in_sql, _files_sql_for

def list_assets_table(
    resolutions: list[IngestResolution],
    *,
    page: int,
    page_size: int,
    green_area_id: int | None = None,
    id_allowlist: list[int] | None = None,
    sort_by: str | None = None,
    sort_dir: str = "asc",
    filters: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int, bool]:
    if not resolutions:
        return [], 0, True
    where: list[str] = ["1=1"]
    if green_area_id is not None:
        where.append(f"green_area_id = {int(green_area_id)}")
    if id_allowlist is not None:
        clause = _id_in_sql(id_allowlist)
        if clause is None:
            return [], 0, True
        where.append(clause)
    where.extend(asset_filter_where(filters))
    total_exact = True
    where_sql = " AND ".join(where)
    allowed_sort = {
        "id",
        "species",
        "family",
        "genus",
        "asset_type",
        "survey_date",
        "health_status",
    }
    order_col = sort_by if sort_by in allowed_sort else "id"
    order_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"
    offset = max(0, (page - 1) * page_size)
    select_cols = (
        "id, green_area_id, region_id, province_id, municipality_id, "
        "asset_type, geometry_type, lon, lat, "
        "species, family, genus, variety, "
        "health_status, asset_status, survey_date, "
        "species_code, trunk_diameter_cm, plant_height_m, crown_diameter_m, "
        "growth_stage, protection_status"
    )

    wide = len(resolutions) > _TABLE_SINGLE_SHOT_MAX

    if wide:
        # Import façade to call through module attribute (monkeypatch compatibility)
        from territory.common.infrastructure.lakehouse import silver_read as _facade

        rows = _facade._wide_select_rows(
            resolutions,
            where_sql=where_sql,
            select_cols=select_cols,
            order_col=order_col,
            order_dir=order_dir,
            offset=offset,
            page_size=page_size,
            stub="assets",
        )
        total, total_source = _facade._resolve_wide_total(
            resolutions,
            where_sql=where_sql,
            offset=offset,
            row_count=len(rows),
            page_size=page_size,
            prefer_gold=True,
            stub="assets",
        )
        total_exact = total_source != "approx"
    else:
        files_sql = _files_sql_for(resolutions, stub="assets")
        con = connect_lakehouse()
        try:
            total = con.execute(
                f"""
                SELECT count(*) FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE {where_sql}
                """
            ).fetchone()[0]
            rows = con.execute(
                f"""
                SELECT {select_cols}
                FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE {where_sql}
                ORDER BY {order_col} {order_dir}
                LIMIT {int(page_size)} OFFSET {int(offset)}
                """
            ).fetchall()
        finally:
            con.close()
        total = int(total)
        total_exact = True

    emit_filter_test_log(
        kind="asset",
        surface="table",
        filters=filters,
        total=int(total),
        n_features=len(rows),
        where_sql=where_sql,
    )

    data = [
        {
            "id": int(r[0]),
            "green_area_id": int(r[1]) if r[1] is not None else None,
            "region_id": int(r[2]),
            "province_id": int(r[3]),
            "municipality_id": int(r[4]),
            "asset_type": r[5],
            "geometry_type": r[6],
            "longitude": float(r[7]) if r[7] is not None else None,
            "latitude": float(r[8]) if r[8] is not None else None,
            "species": r[9],
            "family": r[10],
            "genus": r[11],
            "variety": r[12],
            "health_status": r[13],
            "asset_status": r[14],
            "survey_date": r[15],
            "species_code": r[16],
            "trunk_diameter_cm": float(r[17]) if r[17] is not None else None,
            "plant_height_m": float(r[18]) if r[18] is not None else None,
            "crown_diameter_cm": float(r[19]) if r[19] is not None else None,
            "growth_stage": r[20],
            "protection_status": r[21],
        }
        for r in rows
    ]
    return data, int(total), total_exact
