"""Geo HTTP (web) adapters – one controller per entity."""

from fastapi import APIRouter

from territory.geo.infrastructure.web.region_ctrl import router as region_router
from territory.geo.infrastructure.web.province_ctrl import router as province_router
from territory.geo.infrastructure.web.municipality_ctrl import router as municipality_router
from territory.geo.infrastructure.web.district_ctrl import router as district_router

router = APIRouter(tags=["territory-geo"])
router.include_router(region_router)
router.include_router(province_router)
router.include_router(municipality_router)
router.include_router(district_router)

__all__ = ["router"]
