"""Geo read use cases (catalog regions, provinces, municipalities, sub-municipal areas)."""

from territory.geo.application.usecases.query.catalog_regions import CatalogRegion
from territory.geo.application.usecases.query.catalog_provinces_by_region import CatalogProvinceByRegion
from territory.geo.application.usecases.query.catalog_municipalities_by_province import (
    CatalogMunicipalityByProvince,
)
from territory.geo.application.usecases.query.catalog_sub_municipal_areas_by_municipality import (
    CatalogSubMunicipalAreasByMunicipality,
)
from territory.geo.application.usecases.query.search_territory_hierarchy import (
    SearchTerritoryHierarchy,
)

__all__ = [
    "CatalogRegion",
    "CatalogProvinceByRegion",
    "CatalogMunicipalityByProvince",
    "CatalogSubMunicipalAreasByMunicipality",
    "SearchTerritoryHierarchy",
]
