"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_repository import GreenAssetsRepository

_EMPTY = {"type": "FeatureCollection", "features": []}


@lru_cache(maxsize=512)
def _cached_green_assets(
    region_id: int,
    municipality_id: int,
    sub_municipal_area_id: int | None,
    green_area_id: int | None,
) -> GeoJSONFeatureCollection:
    from territory.assets.infrastructure.repository import _green_assets_repository
    repo = _green_assets_repository()
    if green_area_id is not None:
        return repo.get_within_area(region_id, municipality_id, green_area_id)
    if sub_municipal_area_id is not None:
        return repo.get_within_municipality_and_sub_municipal_area(
            region_id, municipality_id, sub_municipal_area_id
        )
    return repo.get_within_municipality(region_id, municipality_id)


class CatalogGreenAsset:
    def __init__(self, repository: GreenAssetsRepository) -> None:
        self._repository = repository

    def catalog_green_assets(
        self,
        region_id: int,
        municipality_id: int,
        *,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return _cached_green_assets(
            region_id, municipality_id, sub_municipal_area_id, green_area_id
        )
