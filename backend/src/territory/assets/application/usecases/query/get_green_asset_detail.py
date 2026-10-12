"""Use case: get green asset detail by ID."""

from __future__ import annotations

from core.exceptions.base import NotFoundError
from core.logger import log_invocation
from territory.common.infrastructure.dto.green_detail_out import GreenDetailOut, build_asset_detail
from territory.assets.infrastructure.repository.green_assets_lakehouse_repository import (
    GreenAssetsLakehouseRepository,
)


@log_invocation(log_args=True, log_result=False)
def get_green_asset_detail(
    repository: GreenAssetsLakehouseRepository,
    asset_id: int,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> GreenDetailOut:
    """Fetch green asset detail by primary key."""
    row = repository.get_detail_by_pk(
        asset_id,
        region_id,
        province_id,
        municipality_id=municipality_id,
    )
    if row is None:
        raise NotFoundError()
    # Single silver read: bbox/geometry derived from the same row (was 3×
    # province-wide Parquet scans ≈1.2s each path).
    from territory.common.infrastructure.lakehouse import silver_read

    bbox = silver_read.read_asset_bbox(row)
    geometry = silver_read.read_asset_geometry(row)
    out = build_asset_detail(row, bbox=bbox, geometry=geometry)
    return out
