"""Maps green area query rows to GeoJSON FeatureCollection."""

from core.builders import build_feature_collection

from territory.geo.domain.entities import GeoJSONFeatureCollection

_GREEN_AREA_PROPERTIES = ["name", "level", "parent_id", "region_id"]


def build_green_area_feature_collection(
    rows: list[tuple],
) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from green area rows."""
    return build_feature_collection(rows, _GREEN_AREA_PROPERTIES)
