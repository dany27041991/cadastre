"""Geo use cases: catalog regions, provinces, municipalities, sub-municipal areas."""

from territory.geo.application.usecases.query import (
    CatalogRegion,
    CatalogProvinceByRegion,
    CatalogMunicipalityByProvince,
    CatalogSubMunicipalAreasByMunicipality,
)

__all__ = [
    "CatalogRegion",
    "CatalogProvinceByRegion",
    "CatalogMunicipalityByProvince",
    "CatalogSubMunicipalAreasByMunicipality",
]
