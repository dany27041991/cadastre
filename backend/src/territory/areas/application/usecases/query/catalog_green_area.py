"""Use case: catalog green areas (N-level hierarchy)."""

from core.cache import CompressedLRUCache
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.areas.infrastructure.repository.green_areas_repository import GreenAreasRepository

_EMPTY = {"type": "FeatureCollection", "features": []}
# Cache key: (region_id, province_id, municipality_id[, sub_municipal_area_id]). No cache for "children of area" (parent_id set).
_green_area_cache: CompressedLRUCache = CompressedLRUCache(maxsize=2048)


def _cached_green_areas(
    region_id: int,
    province_id: int,
    parent_id: int | None,
    municipality_id: int | None,
    sub_municipal_area_id: int | None = None,
    contained_in_area_id: int | None = None,
) -> GeoJSONFeatureCollection:
    from territory.areas.infrastructure.repository import _green_areas_repository
    repo = _green_areas_repository()
    if contained_in_area_id is not None and municipality_id is not None:
        return repo.get_contained_or_intersecting_area(
            contained_in_area_id, region_id, province_id, municipality_id
        )
    if parent_id is not None:
        return repo.get_by_parent(parent_id, region_id)
    if municipality_id is None:
        return _EMPTY
    if sub_municipal_area_id is not None:
        key = (region_id, province_id, municipality_id, sub_municipal_area_id)
        if key in _green_area_cache:
            return _green_area_cache[key]
        result = repo.get_roots_by_municipality_intersecting_sub_municipal_area(
            municipality_id, region_id, province_id, sub_municipal_area_id
        )
        _green_area_cache[key] = result
        return result
    key = (region_id, province_id, municipality_id)
    if key in _green_area_cache:
        return _green_area_cache[key]
    result = repo.get_roots_by_municipality(municipality_id, region_id, province_id)
    _green_area_cache[key] = result
    return result


def invalidate_cache() -> None:
    """Clear the entire green areas cache."""
    _green_area_cache.clear()


def invalidate_cache_for_municipality(
    region_id: int,
    province_id: int | None,
    municipality_id: int,
) -> None:
    """Invalidate cache for a comune (region, province, municipality_id)."""
    key_prefix = (region_id, province_id, municipality_id)
    to_remove = [k for k in list(_green_area_cache) if (k[0], k[1], k[2]) == key_prefix]
    for k in to_remove:
        del _green_area_cache[k]


class CatalogGreenArea:
    """With parent_id: children of that area. Without: root areas for municipality. Region and province required."""

    def __init__(self, repository: GreenAreasRepository) -> None:
        self._repository = repository

    def catalog_green_areas(
        self,
        region_id: int,
        *,
        province_id: int,
        parent_id: int | None = None,
        municipality_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        contained_in_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return _cached_green_areas(
            region_id,
            province_id,
            parent_id,
            municipality_id,
            sub_municipal_area_id,
            contained_in_area_id,
        )
