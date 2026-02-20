"""Geo use cases: catalog regions, provinces, municipalities, districts."""

from territory.geo.application.usecases.query import (
    CatalogRegion,
    CatalogProvinceByRegion,
    CatalogMunicipalityByProvince,
    CatalogDistrictByMunicipality,
)

__all__ = [
    "CatalogRegion",
    "CatalogProvinceByRegion",
    "CatalogMunicipalityByProvince",
    "CatalogDistrictByMunicipality",
]
