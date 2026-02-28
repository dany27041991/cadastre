"""Maps geo query rows to GeoJSON FeatureCollection (one entry point per entity)."""

from core.builders import build_feature_collection

from territory.geo.domain.entities import GeoJSONFeatureCollection

_REGION_PROPERTIES = ["code", "name"]
_PROVINCE_PROPERTIES = ["code", "name", "vehicle_registration_code"]
_MUNICIPALITY_PROPERTIES = ["istat_code", "name"]
_SUB_MUNICIPAL_AREA_PROPERTIES = ["code", "name", "level", "area_type", "parent_id"]


def build_region_feature_collection(rows: list[tuple]) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from region rows (id, geometry, code, name)."""
    return build_feature_collection(rows, _REGION_PROPERTIES)


def build_province_feature_collection(rows: list[tuple]) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from province rows."""
    return build_feature_collection(rows, _PROVINCE_PROPERTIES)


def build_municipality_feature_collection(
    rows: list[tuple],
) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from municipality rows."""
    return build_feature_collection(rows, _MUNICIPALITY_PROPERTIES)


def build_sub_municipal_area_feature_collection(
    rows: list[tuple],
) -> GeoJSONFeatureCollection:
    """Build FeatureCollection from sub-municipal area rows (public.sub_municipal_area)."""
    return build_feature_collection(rows, _SUB_MUNICIPAL_AREA_PROPERTIES)
