"""Geo infrastructure: mappers from DB rows to GeoJSON FeatureCollection."""

from territory.geo.infrastructure.mapper.feature_collection_mapper import (
    build_region_feature_collection,
    build_province_feature_collection,
    build_municipality_feature_collection,
    build_sub_municipal_area_feature_collection,
)

__all__ = [
    "build_region_feature_collection",
    "build_province_feature_collection",
    "build_municipality_feature_collection",
    "build_sub_municipal_area_feature_collection",
]
