"""List areas in table format."""

from __future__ import annotations

from datetime import date
from typing import Any

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse
from territory.common.infrastructure.lakehouse.filter_test_log import emit_filter_test_log
from territory.common.infrastructure.lakehouse.table_filters import (
    area_filter_where,
)

from .constants import _TABLE_SINGLE_SHOT_MAX
from .sql import _id_in_sql, _files_sql_for


def list_areas_table(
    resolutions: list[IngestResolution],
    *,
    page: int,
    page_size: int,
    sort_by: str | None = None,
    sort_dir: str = "asc",
    filters: dict[str, Any] | None = None,
    area_id: int | None = None,
    parent_id: int | None = None,
    contained_in_area_id: int | None = None,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    id_allowlist: list[int] | None = None,
    default_roots_only: bool = True,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Paginated areas table.

    Territory scope (mirrors legacy PostGIS):
    - ``area_id`` exact row
    - else ``parent_id`` children
    - else ``contained_in_area_id`` / ``id_allowlist`` (precomputed spatial kids / sub-municipal)
    - else roots only (``parent_id IS NULL``) when ``default_roots_only``
    """
    if not resolutions:
        return [], 0, True
    where: list[str] = ["1=1"]
    filters = filters or {}
    total_exact = True
    if area_id is not None:
        where.append(f"id = {int(area_id)}")
    elif parent_id is not None:
        where.append(f"parent_id = {int(parent_id)}")
    elif contained_in_area_id is not None:
        if region_id is None or province_id is None or municipality_id is None:
            return [], 0, True
        # Import façade for catalog function
        from territory.common.infrastructure.lakehouse import silver_read as _facade

        # Spatial children only (exclude selected), same as legacy table query.
        child_rows = _facade.read_areas_contained_or_intersecting(
            resolutions,
            area_id=contained_in_area_id,
            region_id=region_id,
            province_id=province_id,
            municipality_id=municipality_id,
        )
        child_ids = [int(r[0]) for r in child_rows[1:]]
        clause = _id_in_sql(child_ids)
        if clause is None:
            return [], 0, True
        where.append(clause)
    elif id_allowlist is not None:
        clause = _id_in_sql(id_allowlist)
        if clause is None:
            return [], 0, True
        where.append(clause)
    elif default_roots_only:
        where.append("parent_id IS NULL")
    where.extend(area_filter_where(filters))
    where_sql = " AND ".join(where)
    order_col = sort_by if sort_by in {"id", "name", "level", "survey_date"} else "id"
    order_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"
    offset = max(0, (page - 1) * page_size)
    select_cols = (
        "id, region_id, province_id, municipality_id, parent_id, level, name, "
        "lon, lat, area_classification, administrative_status, survey_date, "
        "zril_identifier, istat_classification, intensity_of_fruition, "
        "perimeter_type, surface_area_m2"
    )

    wide = len(resolutions) > _TABLE_SINGLE_SHOT_MAX

    # #region agent log
    def _dbg_areas(message: str, data: dict, hypothesis_id: str = "H1") -> None:
        try:
            import json as _json
            import time as _time
            import urllib.request as _urlreq

            payload = _json.dumps(
                {
                    "sessionId": "4fe799",
                    "hypothesisId": hypothesis_id,
                    "location": "silver_read.list_areas_table",
                    "message": message,
                    "data": data,
                    "timestamp": int(_time.time() * 1000),
                }
            ).encode("utf-8")
            _urlreq.urlopen(
                _urlreq.Request(
                    "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "4fe799",
                    },
                    method="POST",
                ),
                timeout=1.5,
            )
        except Exception:
            pass

    _dbg_areas(
        "list_areas_table_enter",
        {
            "n_resolutions": len(resolutions),
            "wide": wide,
            "where_sql": where_sql[:300],
            "select_has_v11": "zril_identifier" in select_cols,
            "filter_keys": sorted(filters.keys()),
            "filters": {k: str(v)[:80] for k, v in filters.items()},
        },
        hypothesis_id="H-and",
    )
    # #endregion

    try:
        if wide:
            # Import façade to call through module attribute (monkeypatch compatibility)
            from territory.common.infrastructure.lakehouse import silver_read as _facade

            # Scope munis via the same filter SQL used by the map (not ZRIL parsing).
            # Without this, 2nd Cerca table walks all ~7.9k munis for tens of seconds
            # while the map already resolved matching munis (debug 4fe799).
            scoped = resolutions
            scope_mode = "all"
            if filters:
                # Widespread name (e.g. "area") must probe_wide — forcing False
                # scanned ~8k munis and hit MinIO IOException (debug 4fe799).
                muni_ids, scope_mode = _facade.resolve_matching_municipality_ids(
                    resolutions,
                    filters,
                    allow_widespread_shortcircuit=True,
                    date_from=date_from,
                    date_to=date_to,
                )
                if muni_ids is not None:
                    if not muni_ids:
                        _dbg_areas(
                            "table_filter_scope_empty",
                            {
                                "scope_mode": scope_mode,
                                "filter_keys": sorted(filters.keys()),
                                "filters": {k: str(v)[:80] for k, v in filters.items()},
                            },
                            hypothesis_id="H-filter-scope",
                        )
                        return [], 0, True
                    mid_set = {int(m) for m in muni_ids}
                    scoped = [
                        r for r in resolutions if int(r.municipality_id) in mid_set
                    ]
                    scope_mode = f"{scope_mode}:n={len(mid_set)}"
                else:
                    # probe_wide: pin munis from dense-first area matches instead
                    # of walking all resolutions (national ILIKE thrash).
                    pairs = _facade.resolve_matching_areas(
                        resolutions,
                        filters,
                        limit=max(int(page_size) * 100, 2_000),
                        date_from=date_from,
                        date_to=date_to,
                    )
                    if not pairs:
                        _dbg_areas(
                            "table_filter_scope_empty",
                            {
                                "scope_mode": "probe_wide_pin",
                                "filter_keys": sorted(filters.keys()),
                                "filters": {
                                    k: str(v)[:80] for k, v in filters.items()
                                },
                            },
                            hypothesis_id="H-filter-scope",
                        )
                        return [], 0, True
                    mid_set = {int(m) for _, m in pairs}
                    scoped = [
                        r for r in resolutions if int(r.municipality_id) in mid_set
                    ]
                    scope_mode = f"probe_wide_pin:n={len(mid_set)}"
            # #region agent log
            _dbg_areas(
                "table_filter_scope",
                {
                    "scope_mode": scope_mode,
                    "n_resolutions_in": len(resolutions),
                    "n_scoped": len(scoped),
                    "filter_keys": sorted(filters.keys()),
                    "filters": {k: str(v)[:80] for k, v in filters.items()},
                    "date_from": str(date_from) if date_from else None,
                    "date_to": str(date_to) if date_to else None,
                },
                hypothesis_id="H-filter-scope",
            )
            # #endregion

            rows = _facade._wide_select_rows(
                scoped,
                where_sql=where_sql,
                select_cols=select_cols,
                order_col=order_col,
                order_dir=order_dir,
                offset=offset,
                page_size=page_size,
                stub="areas",
            )
            total, total_source = _facade._resolve_wide_total(
                scoped,
                where_sql=where_sql,
                offset=offset,
                row_count=len(rows),
                page_size=page_size,
                prefer_gold=True,
                stub="areas",
            )
            total_exact = total_source != "approx"
        else:
            files_sql = _files_sql_for(resolutions, stub="areas")
            con = connect_lakehouse()
            try:
                total = con.execute(
                    f"SELECT count(*) FROM read_parquet([{files_sql}], union_by_name=true) WHERE {where_sql}"
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
    except Exception as exc:  # #region agent log
        _dbg_areas(
            "list_areas_table_error",
            {
                "err_type": type(exc).__name__,
                "err": str(exc)[:500],
                "n_resolutions": len(resolutions),
                "wide": wide,
            },
            hypothesis_id="H1",
        )
        raise
        # #endregion

    # #region agent log
    _dbg_areas(
        "list_areas_table_ok",
        {
            "total": int(total),
            "nrows": len(rows),
            "wide": wide,
            "total_exact": total_exact,
            "where_sql": where_sql[:500],
            "has_survey_range": bool(
                filters.get("survey_date_from") or filters.get("survey_date_to")
            ),
            "survey_date_from": filters.get("survey_date_from"),
            "survey_date_to": filters.get("survey_date_to"),
            "row_survey_dates": [
                str(r[11]) if len(r) > 11 else None for r in rows[:5]
            ],
        },
        hypothesis_id="H-survey-exclude",
    )
    # When survey range yields 0, show what would match without the date filter
    # so the exclusion reason is obvious in debug logs.
    if (
        int(total) == 0
        and len(rows) == 0
        and (filters.get("survey_date_from") or filters.get("survey_date_to"))
    ):
        try:
            filters_no_survey = {
                k: v
                for k, v in filters.items()
                if k not in ("survey_date_from", "survey_date_to")
            }
            where_no_survey_parts = ["1=1"]
            if default_roots_only and area_id is None and parent_id is None:
                where_no_survey_parts.append("parent_id IS NULL")
            # Use module-level area_filter_where (do not re-import here:
            # a late local import shadows the name for the whole function
            # and causes UnboundLocalError on the earlier call above).
            where_no_survey_parts.extend(area_filter_where(filters_no_survey))
            where_no_survey = " AND ".join(where_no_survey_parts)
            from territory.common.infrastructure.lakehouse import silver_read as _facade

            probe = _facade._wide_select_rows(
                resolutions,
                where_sql=where_no_survey,
                select_cols=select_cols,
                order_col=order_col,
                order_dir=order_dir,
                offset=0,
                page_size=min(5, page_size),
                stub="areas",
            )
            _dbg_areas(
                "list_areas_excluded_by_survey_date",
                {
                    "survey_date_from": filters.get("survey_date_from"),
                    "survey_date_to": filters.get("survey_date_to"),
                    "n_without_survey": len(probe),
                    "would_match": [
                        {
                            "id": int(r[0]),
                            "name": r[6],
                            "zril": r[12],
                            "survey_date": str(r[11]),
                        }
                        for r in probe[:5]
                    ],
                    "reason": (
                        "survey_date of candidate(s) outside requested range "
                        "→ table+map correctly empty"
                    ),
                },
                hypothesis_id="H-survey-exclude",
            )
        except Exception as _probe_exc:
            _dbg_areas(
                "list_areas_survey_probe_error",
                {"err": str(_probe_exc)[:300]},
                hypothesis_id="H-survey-exclude",
            )
    # #endregion
    emit_filter_test_log(
        kind="area",
        surface="table",
        filters=filters,
        total=int(total),
        n_features=len(rows),
        where_sql=where_sql,
    )

    data = [
        {
            "id": int(r[0]),
            "region_id": int(r[1]),
            "province_id": int(r[2]),
            "municipality_id": int(r[3]),
            "parent_id": int(r[4]) if r[4] is not None else None,
            "level": int(r[5]),
            "name": r[6],
            "longitude": float(r[7]) if r[7] is not None else None,
            "latitude": float(r[8]) if r[8] is not None else None,
            "area_classification": r[9],
            "administrative_status": r[10],
            "survey_date": r[11],
            "zril_identifier": r[12],
            "istat_classification": r[13],
            "intensity_of_fruition": r[14],
            "perimeter_type": r[15],
            "surface_area_m2": float(r[16]) if r[16] is not None else None,
        }
        for r in rows
    ]
    return data, int(total), total_exact
