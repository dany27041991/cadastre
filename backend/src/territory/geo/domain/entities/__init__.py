"""Geo domain entities."""

from typing import Any

from .region_model import RegionModel
from .province_model import ProvinceModel
from .municipality_model import MunicipalityModel
from .district_model import DistrictModel

GeoJSONFeatureCollection = dict[str, Any]

__all__ = [
    "GeoJSONFeatureCollection",
    "RegionModel",
    "ProvinceModel",
    "MunicipalityModel",
    "DistrictModel",
]
