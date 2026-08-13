"""HTTP controller: territory hierarchy typeahead search."""

from fastapi import APIRouter, Query

from core.api.dependencies import get_territory_search_uc
from territory.geo.infrastructure.dto.output.territory_search_out import (
    TerritorySearchHitOut,
    TerritorySearchResponseOut,
)

router = APIRouter(tags=["territory-geo-search"])


@router.get("/search", response_model=TerritorySearchResponseOut)
def search_territory(
    q: str = Query("", description="Free-text hierarchy search"),
    limit: int = Query(20, ge=1, le=50),
) -> TerritorySearchResponseOut:
    rows = get_territory_search_uc().search(q=q, limit=limit)
    return TerritorySearchResponseOut(
        items=[TerritorySearchHitOut.model_validate(row) for row in rows]
    )
