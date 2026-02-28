"""Geo repositories and wiring (use case factories)."""

from core.database import get_session

from territory.geo.application.usecases.query import (
    CatalogRegion,
    CatalogProvinceByRegion,
    CatalogMunicipalityByProvince,
    CatalogSubMunicipalAreasByMunicipality,
)
from territory.geo.infrastructure.repository.region_repository import RegionRepository
from territory.geo.infrastructure.repository.province_repository import ProvinceRepository
from territory.geo.infrastructure.repository.municipality_repository import MunicipalityRepository
from territory.geo.infrastructure.repository.sub_municipal_area_repository import (
    SubMunicipalAreaRepository,
)


def _region_repository() -> RegionRepository:
    return RegionRepository(session_factory=get_session)


def _province_repository() -> ProvinceRepository:
    return ProvinceRepository(session_factory=get_session)


def _municipality_repository() -> MunicipalityRepository:
    return MunicipalityRepository(session_factory=get_session)


def _sub_municipal_area_repository() -> SubMunicipalAreaRepository:
    return SubMunicipalAreaRepository(session_factory=get_session)


def get_regions_use_case() -> CatalogRegion:
    return CatalogRegion(_region_repository())


def get_provinces_by_region_use_case() -> CatalogProvinceByRegion:
    return CatalogProvinceByRegion(_province_repository())


def get_municipalities_by_province_use_case() -> CatalogMunicipalityByProvince:
    return CatalogMunicipalityByProvince(_municipality_repository())


def get_sub_municipal_areas_by_municipality_use_case() -> CatalogSubMunicipalAreasByMunicipality:
    return CatalogSubMunicipalAreasByMunicipality(_sub_municipal_area_repository())


__all__ = [
    "RegionRepository",
    "ProvinceRepository",
    "MunicipalityRepository",
    "SubMunicipalAreaRepository",
    "get_regions_use_case",
    "get_provinces_by_region_use_case",
    "get_municipalities_by_province_use_case",
    "get_sub_municipal_areas_by_municipality_use_case",
]
