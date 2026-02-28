"""Geo domain entities."""

from typing import Any

from .region_model import RegionModel
from .province_model import ProvinceModel
from .municipality_model import MunicipalityModel
from .sub_municipal_area_model import SubMunicipalAreaModel
from .census_section_model import CensusSectionModel
from .area_level_model import AreaLevelModel
from .primary_type_model import PrimaryTypeModel
from .secondary_type_model import SecondaryTypeModel
from .attribute_type_model import AttributeTypeModel
from .enums import CensusLayerType, GeomType

GeoJSONFeatureCollection = dict[str, Any]

__all__ = [
    "GeoJSONFeatureCollection",
    "RegionModel",
    "ProvinceModel",
    "MunicipalityModel",
    "SubMunicipalAreaModel",
    "CensusSectionModel",
    "AreaLevelModel",
    "PrimaryTypeModel",
    "SecondaryTypeModel",
    "AttributeTypeModel",
    "CensusLayerType",
    "GeomType",
]
