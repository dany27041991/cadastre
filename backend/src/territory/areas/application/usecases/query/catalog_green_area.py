"""Use case: catalog green areas (N-level hierarchy)."""

from core.cache import CompressedLRUCache
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.areas.infrastructure.repository.green_areas_repository import GreenAreasRepository

_EMPTY = {"type": "FeatureCollection", "features": []}
# Cache key: (region_id, province_id, municipality_id, sub_municipal_area_id).
# sub_municipal_area_id is optional (None when comune has no sub-municipal division).
# No cache for "children of area" (parent_id set).
_green_area_cache: CompressedLRUCache = CompressedLRUCache(maxsize=2048)


def _cached_green_areas(
    region_id: int,
    parent_id: int | None,
    province_id: int | None,
    municipality_id: int | None,
    sub_municipal_area_id: int | None,
) -> GeoJSONFeatureCollection:
    from territory.areas.infrastructure.repository import _green_areas_repository
    repo = _green_areas_repository()
    if parent_id is not None:
        return repo.get_by_parent(parent_id, region_id)
    if municipality_id is None:
        return _EMPTY
    key = (region_id, province_id, municipality_id, sub_municipal_area_id)
    if key in _green_area_cache:
        return _green_area_cache[key]
    if sub_municipal_area_id is not None:
        result = repo.get_roots_by_municipality_and_sub_municipal_area(
            municipality_id, sub_municipal_area_id, region_id
        )
    else:
        result = repo.get_roots_by_municipality(municipality_id, region_id)
    _green_area_cache[key] = result
    return result


def invalidate_cache() -> None:
    """Clear the entire green areas cache."""
    _green_area_cache.clear()


def invalidate_cache_for_municipality(
    region_id: int,
    province_id: int | None,
    municipality_id: int,
    sub_municipal_area_id: int | None = None,
) -> None:
    """Invalidate cache for a comune (region, province, municipality_id).
    sub_municipal_area_id optional: if None, invalidates whole comune; else only that sub-municipal entry."""
    key_prefix = (region_id, province_id, municipality_id)
    to_remove = [
        k for k in list(_green_area_cache)
        if (k[0], k[1], k[2]) == key_prefix
        and (sub_municipal_area_id is None or k[3] == sub_municipal_area_id)
    ]
    for k in to_remove:
        del _green_area_cache[k]


class CatalogGreenArea:
    """With parent_id: children of that area. Without: root areas for municipality (opt. sub_municipal_area_id)."""

    def __init__(self, repository: GreenAreasRepository) -> None:
        self._repository = repository

    def catalog_green_areas(
        self,
        region_id: int,
        *,
        parent_id: int | None = None,
        province_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return _cached_green_areas(
            region_id, parent_id, province_id, municipality_id, sub_municipal_area_id
        )
