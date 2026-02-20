"""Maps green asset query rows to GeoJSON FeatureCollection."""

from core.builders import build_feature_collection

from territory.geo.domain.entities import GeoJSONFeatureCollection

_GREEN_ASSET_PROPERTIES = ["asset_type", "geometry_type", "species"]


def build_green_asset_feature_collection(
    rows: list[tuple],
) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from green asset rows."""
    return build_feature_collection(rows, _GREEN_ASSET_PROPERTIES)
