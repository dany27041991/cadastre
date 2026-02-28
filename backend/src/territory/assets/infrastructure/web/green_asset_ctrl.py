"""Green assets HTTP routes."""

import geobuf

from fastapi import APIRouter
from fastapi.responses import Response

from core.api.dependencies import get_green_assets_uc
from territory.assets.application.usecases.query.catalog_green_asset import _cached_green_assets
from territory.assets.infrastructure.dto.output import GreenAssetsOutput

router = APIRouter(tags=["territory-assets"])

GEOBUF_MEDIA_TYPE = "application/x-geobuf"


def _empty_geobuf() -> bytes:
    fc = {"type": "FeatureCollection", "features": []}
    return geobuf.encode(fc)


def _geobuf_response(content: bytes, hits: int, misses: int) -> Response:
    r = Response(content=content, media_type=GEOBUF_MEDIA_TYPE)
    r.headers["X-Cache-Hits"] = str(hits)
    r.headers["X-Cache-Misses"] = str(misses)
    return r


@router.get("/green-assets", response_model=None)
def get_green_assets(
    region_id: int,
    municipality_id: int,
    sub_municipal_area_id: int | None = None,
    green_area_id: int | None = None,
    format: str | None = None,
) -> GreenAssetsOutput | Response:
    """Return green assets (trees, rows, lawns, etc.) for the given area.
    Use ?format=geobuf for compact binary response (6-8x smaller, faster transfer)."""
    result = get_green_assets_uc().catalog_green_assets(
        region_id,
        municipality_id,
        sub_municipal_area_id=sub_municipal_area_id,
        green_area_id=green_area_id,
    )
    ci = _cached_green_assets.cache_info()

    if not result.get("features"):
        if format == "geobuf":
            return _geobuf_response(_empty_geobuf(), ci.hits, ci.misses)
        return GreenAssetsOutput(features=[])

    if format == "geobuf":
        pbf_bytes = geobuf.encode(result)
        return _geobuf_response(pbf_bytes, ci.hits, ci.misses)

    return GreenAssetsOutput.model_validate(result)
