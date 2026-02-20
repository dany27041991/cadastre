"""Geo read use cases (catalog regions, provinces, municipalities, districts)."""

from territory.geo.application.usecases.query.catalog_regions import CatalogRegion
from territory.geo.application.usecases.query.catalog_provinces_by_region import CatalogProvinceByRegion
from territory.geo.application.usecases.query.catalog_municipalities_by_province import (
    CatalogMunicipalityByProvince,
)
from territory.geo.application.usecases.query.catalog_districts_by_municipality import (
    CatalogDistrictByMunicipality,
)

__all__ = [
    "CatalogRegion",
    "CatalogProvinceByRegion",
    "CatalogMunicipalityByProvince",
    "CatalogDistrictByMunicipality",
]
