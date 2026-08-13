"""Geo use cases: catalog regions, provinces, municipalities, sub-municipal areas, search."""

from territory.geo.application.usecases.query import (
    CatalogRegion,
    CatalogProvinceByRegion,
    CatalogMunicipalityByProvince,
    CatalogSubMunicipalAreasByMunicipality,
    SearchTerritoryHierarchy,
)

__all__ = [
    "CatalogRegion",
    "CatalogProvinceByRegion",
    "CatalogMunicipalityByProvince",
    "CatalogSubMunicipalAreasByMunicipality",
    "SearchTerritoryHierarchy",
]
