"""Enums for cadastre ASSET_AREA (green_areas). Matches 02-init-schema-cadastre.sql."""

from .intensity_of_fruition import IntensityOfFruition
from .perimeter_type import PerimeterType
from .administrative_status import AdministrativeStatus
from .operational_status import OperationalStatus
from .survey_status import SurveyStatus
from .istat_green_area_classification import IstatGreenAreaClassification

# Shared with ASSET_GREEN: single geometry_type enum (P/L/S)
from territory.assets.domain.entities.enums import GeometryType

__all__ = [
    "IntensityOfFruition",
    "GeometryType",
    "PerimeterType",
    "AdministrativeStatus",
    "OperationalStatus",
    "SurveyStatus",
    "IstatGreenAreaClassification",
]
