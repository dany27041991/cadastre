"""Use case: list green assets table with pagination and filters."""

from __future__ import annotations

from typing import Any, Literal

from territory.common.infrastructure.green_metadata_projection import merge_asset_table_row
from territory.common.infrastructure.green_table_page_out import GreenTablePageOut
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)


def list_green_assets_table_paged(
    repository: GreenAssetsLakehouseRepository,
    region_id: int | None,
    municipality_id: int | None,
    *,
    province_id: int | None = None,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    clip_wkt: str | None = None,
    page: int = 1,
    page_size: int = 50,
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    filters: dict[str, Any] | None = None,
) -> GreenTablePageOut:
    """List green assets table rows with pagination, sorting, and filters."""
    raw, total, total_exact = repository.list_table_rows_paged(
        region_id,
        province_id,
        municipality_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
        clip_wkt=clip_wkt,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filters=filters,
    )
    enriched = [merge_asset_table_row(r) for r in raw] if raw else raw
    return GreenTablePageOut.build(
        data=enriched,
        total=total,
        page=page,
        page_size=page_size,
        total_exact=total_exact,
    )
