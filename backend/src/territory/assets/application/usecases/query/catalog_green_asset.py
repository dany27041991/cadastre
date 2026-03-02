"""Use case: catalog green assets (trees, rows, lawns, etc.) for an area."""

from core.cache import CompressedLRUCache
from territory.geo.domain.entities import GeoJSONFeatureCollection
from territory.assets.infrastructure.repository.green_assets_repository import GreenAssetsRepository

_EMPTY = {"type": "FeatureCollection", "features": []}
# Cache key: (region_id, province_id, municipality_id, sub_municipal_area_id).
# sub_municipal_area_id optional (None when comune has no sub-municipal division).
# No cache for single green_area_id (billions of areas).
_green_asset_cache: CompressedLRUCache = CompressedLRUCache(maxsize=2048)


def _cached_green_assets(
    region_id: int,
    province_id: int | None,
    municipality_id: int,
    sub_municipal_area_id: int | None,
    green_area_id: int | None,
) -> GeoJSONFeatureCollection:
    from territory.assets.infrastructure.repository import _green_assets_repository
    repo = _green_assets_repository()
    if green_area_id is not None:
        return repo.get_within_area(region_id, municipality_id, green_area_id)
    key = (region_id, province_id, municipality_id, sub_municipal_area_id)
    if key in _green_asset_cache:
        return _green_asset_cache[key]
    if sub_municipal_area_id is not None:
        result = repo.get_within_municipality_and_sub_municipal_area(
            region_id, municipality_id, sub_municipal_area_id
        )
    else:
        result = repo.get_within_municipality(region_id, municipality_id)
    _green_asset_cache[key] = result
    return result


def invalidate_cache() -> None:
    """Clear the entire green assets cache."""
    _green_asset_cache.clear()


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
        k for k in list(_green_asset_cache)
        if (k[0], k[1], k[2]) == key_prefix
        and (sub_municipal_area_id is None or k[3] == sub_municipal_area_id)
    ]
    for k in to_remove:
        del _green_asset_cache[k]


class CatalogGreenAsset:
    def __init__(self, repository: GreenAssetsRepository) -> None:
        self._repository = repository

    def catalog_green_assets(
        self,
        region_id: int,
        municipality_id: int,
        *,
        province_id: int | None = None,
        sub_municipal_area_id: int | None = None,
        green_area_id: int | None = None,
    ) -> GeoJSONFeatureCollection:
        return _cached_green_assets(
            region_id, province_id, municipality_id, sub_municipal_area_id, green_area_id
        )
