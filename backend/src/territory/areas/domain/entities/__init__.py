"""Areas domain entities."""

from territory.geo.domain.entities import GeoJSONFeatureCollection

from .green_area_model import GreenAreaModel
from .asset_area_history_model import AssetAreaHistoryModel
from .enums import (
    IntensityOfFruition,
    GeometryType,
    PerimeterType,
    AdministrativeStatus,
    OperationalStatus,
    SurveyStatus,
)

__all__ = [
    "GeoJSONFeatureCollection",
    "GreenAreaModel",
    "AssetAreaHistoryModel",
    "IntensityOfFruition",
    "GeometryType",
    "PerimeterType",
    "AdministrativeStatus",
    "OperationalStatus",
    "SurveyStatus",
]
