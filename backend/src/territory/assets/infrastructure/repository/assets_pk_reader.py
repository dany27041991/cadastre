"""Functions for reading individual assets by primary key."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from territory.common.infrastructure.lakehouse import silver_read

if TYPE_CHECKING:
    pass


def get_by_pk(
    resolutions,
    asset_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> dict[str, Any] | None:
    return silver_read.read_asset_by_pk(
        resolutions,
        asset_id,
        region_id,
        province_id,
        municipality_id=municipality_id,
    )


def get_bbox_by_pk(
    resolutions,
    asset_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> list[float] | None:
    row = get_by_pk(
        resolutions, asset_id, region_id, province_id, municipality_id=municipality_id
    )
    if row is None:
        return None
    return silver_read.read_asset_bbox(row)


def get_geometry_by_pk(
    resolutions,
    asset_id: int,
    region_id: int,
    province_id: int,
    municipality_id: int | None = None,
) -> dict[str, Any] | None:
    row = get_by_pk(
        resolutions, asset_id, region_id, province_id, municipality_id=municipality_id
    )
    if row is None:
        return None
    return silver_read.read_asset_geometry(row)
