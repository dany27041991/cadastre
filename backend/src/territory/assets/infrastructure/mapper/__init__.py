"""Assets infrastructure: mapper from DB rows to GeoJSON."""

from territory.assets.infrastructure.mapper.green_asset_feature_collection_mapper import (
    build_green_asset_feature_collection,
)

__all__ = ["build_green_asset_feature_collection"]
