"""Functions for listing assets in table format with pagination."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

from territory.common.infrastructure.lakehouse import silver_read

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.orm import Session


def list_table_rows_paged(
    session_factory: Callable[[], Session],
    resolutions,
    region_id: int | None,
    province_id: int | None,
    municipality_id: int | None,
    *,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = None,
    page: int = 1,
    page_size: int = 50,
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    filters: dict[str, Any] | None = None,
) -> tuple[list[dict], int, bool]:
    id_allowlist: list[int] | None = None
    if (
        municipality_id is not None
        and region_id is not None
        and province_id is not None
        and (sub_municipal_area_id is not None or clip_wkt)
    ):
        from territory.assets.infrastructure.repository.assets_scope_helpers import (
            load_sub_municipal_geom,
        )

        clip_geom = silver_read._parse_clip_geom(clip_wkt)
        if sub_municipal_area_id is not None:
            sub = load_sub_municipal_geom(session_factory, municipality_id, sub_municipal_area_id)
            if sub is None:
                return [], 0, True
            clip_geom = sub if clip_geom is None else clip_geom.intersection(sub)
            if clip_geom is None or clip_geom.is_empty:
                return [], 0, True
        if clip_geom is not None:
            rows = silver_read.read_assets_intersecting_geom(
                resolutions,
                municipality_id=municipality_id,
                region_id=region_id,
                province_id=province_id,
                clip_geom=clip_geom,
            )
            id_allowlist = [int(r[0]) for r in rows]
    return silver_read.list_assets_table(
        resolutions,
        page=page,
        page_size=page_size,
        green_area_id=green_area_id,
        id_allowlist=id_allowlist,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters,
    )
