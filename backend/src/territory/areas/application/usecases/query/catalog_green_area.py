"""Use case: catalog green areas (N-level hierarchy)."""

from functools import lru_cache

from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.areas.infrastructure.repository.green_areas_repository import GreenAreasRepository

_EMPTY = {"type": "FeatureCollection", "features": []}


@lru_cache(maxsize=512)
def _cached_green_areas(
    region_id: int,
    parent_id: int | None,
    municipality_id: int | None,
    sub_municipal_area_id: int | None,
) -> GeoJSONFeatureCollection:
    from territory.areas.infrastructure.repository import _green_areas_repository
    repo = _green_areas_repository()
    if parent_id is not None:
        return repo.get_by_parent(parent_id, region_id)
    if municipality_id is None:
        return _EMPTY
    if sub_municipal_area_id is not None:
        return repo.get_roots_by_municipality_and_sub_municipal_area(
            municipality_id, sub_municipal_area_id, region_id
        )
    return repo.get_roots_by_municipality(municipality_id, region_id)


class CatalogGreenArea:
    """With parent_id: children of that area. Without: root areas for municipality (opt. sub_municipal_area_id)."""

    def __init__(self, repository: GreenAreasRepository) -> None:
        self._repository = repository

    def catalog_green_areas(
        self,
        region_id: int,
        *,
        parent_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return _cached_green_areas(
            region_id, parent_id, municipality_id, sub_municipal_area_id
        )
