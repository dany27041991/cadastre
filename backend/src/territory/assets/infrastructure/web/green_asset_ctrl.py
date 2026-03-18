"""Green assets HTTP routes."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.infrastructure.dto.output import GreenAssetsOutput

router = APIRouter(tags=["territory-assets"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"


@router.get("/green-assets", response_model=None)
def get_green_assets(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
    format: str | None = None,
) -> GreenAssetsOutput | Response:
    """Return green assets (trees, rows, lawns, etc.) for the given area.
    When sub_municipal_area_id is set, only assets intersecting that sub-municipal area are returned.
    region_id and province_id required. Use ?format=geobuf for compact binary response."""
    result = get_green_assets_uc().catalog_green_assets(
        region_id,
        municipality_id,
        province_id=province_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
    )
    if not result.get("features"):
        if format == "geobuf":
            return Response(
                content=geobuf.encode({"type": "FeatureCollection", "features": []}),
                media_type=GEOBUF_MEDIA_TYPE,
            )
        return GreenAssetsOutput(features=[])

    if format == "geobuf":
        return Response(
            content=geobuf.encode(result),
            media_type=GEOBUF_MEDIA_TYPE,
        )
    return GreenAssetsOutput.model_validate(result)


@router.get("/green-assets/filter", response_model=None)
def get_green_assets_filter(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None = None,
    sub_municipal_area_id: int | None = None,
) -> list[dict]:
    """Dati assets verdi filtrati (stessi query param di GET /green-assets)."""
    return get_green_assets_uc().list_green_assets_table(
        region_id,
        municipality_id,
        province_id=province_id,
        green_area_id=green_area_id,
        sub_municipal_area_id=sub_municipal_area_id,
    )
