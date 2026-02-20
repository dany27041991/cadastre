"""Areas infrastructure: mapper from DB rows to GeoJSON."""

from territory.areas.infrastructure.mapper.green_area_feature_collection_mapper import (
    build_green_area_feature_collection,
)

__all__ = ["build_green_area_feature_collection"]
