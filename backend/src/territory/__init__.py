"""Territory module: composed router (geo + areas + assets)."""

from fastapi import APIRouter

from territory.geo.infrastructure.web import router as geo_router
from territory.areas.infrastructure.web.green_area_ctrl import router as areas_router
from territory.assets.infrastructure.web.green_asset_ctrl import router as assets_router

router = APIRouter(prefix="/api/territory", tags=["territory"])
router.include_router(geo_router)
router.include_router(areas_router)
router.include_router(assets_router)
