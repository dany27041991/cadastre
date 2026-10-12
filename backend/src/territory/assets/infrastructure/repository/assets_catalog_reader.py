"""Functions for reading asset catalogs within areas."""

from __future__ import annotations

from typing import TYPE_CHECKING

from territory.assets.infrastructure.mapper import build_green_asset_feature_collection
from territory.common.infrastructure.lakehouse import silver_read
from territory.geo.domain.entities import GeoJSONFeatureCollection

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.orm import Session

_EMPTY_FC: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}


def get_within_area(
    resolutions,
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int,
) -> GeoJSONFeatureCollection:
    if not resolutions:
        return _EMPTY_FC
    rows = silver_read.read_assets_catalog(
        resolutions,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
        green_area_id=green_area_id,
    )
    return build_green_asset_feature_collection(rows)


def get_within_municipality(
    resolutions,
    region_id: int,
    province_id: int,
    municipality_id: int,
) -> GeoJSONFeatureCollection:
    if not resolutions:
        return _EMPTY_FC
    rows = silver_read.read_assets_catalog(
        resolutions,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
    )
    return build_green_asset_feature_collection(rows)


def get_within_municipality_intersecting_sub_municipal_area(
    session_factory: Callable[[], Session],
    resolutions,
    region_id: int,
    province_id: int,
    municipality_id: int,
    sub_municipal_area_id: int,
) -> GeoJSONFeatureCollection:
    if not resolutions:
        return _EMPTY_FC
    from territory.assets.infrastructure.repository.assets_scope_helpers import (
        load_sub_municipal_geom,
    )

    clip = load_sub_municipal_geom(session_factory, municipality_id, sub_municipal_area_id)
    if clip is None:
        return _EMPTY_FC
    rows = silver_read.read_assets_intersecting_geom(
        resolutions,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
        clip_geom=clip,
    )
    return build_green_asset_feature_collection(rows)
