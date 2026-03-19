"""Cache logic for catalog green assets (trees, rows, lawns, etc.).

Cache key: (region_id, province_id, municipality_id[, sub_municipal_area_id]).
No cache for single green_area_id queries.
"""

from core.cache import CompressedLRUCache
from territory.geo.domain.entities import GeoJSONFeatureCollection

_EMPTY: GeoJSONFeatureCollection = {"type": "FeatureCollection", "features": []}
_green_asset_cache: CompressedLRUCache = CompressedLRUCache(maxsize=2048)


def get_cached_green_assets(
    region_id: int,
    province_id: int,
    municipality_id: int,
    green_area_id: int | None,
    sub_municipal_area_id: int | None = None,
) -> GeoJSONFeatureCollection:
    """Return green assets (from cache when applicable)."""
    from territory.assets.infrastructure.repository import _green_assets_repository

    repo = _green_assets_repository()
    if green_area_id is not None:
        return repo.get_within_area(region_id, province_id, municipality_id, green_area_id)
    if sub_municipal_area_id is not None:
        key = (region_id, province_id, municipality_id, sub_municipal_area_id)
        if key in _green_asset_cache:
            return _green_asset_cache[key]
        result = repo.get_within_municipality_intersecting_sub_municipal_area(
            region_id, province_id, municipality_id, sub_municipal_area_id
        )
        _green_asset_cache[key] = result
        return result
    key = (region_id, province_id, municipality_id)
    if key in _green_asset_cache:
        return _green_asset_cache[key]
    result = repo.get_within_municipality(region_id, province_id, municipality_id)
    _green_asset_cache[key] = result
    return result


def invalidate_cache() -> None:
    """Clear the entire green assets cache."""
    _green_asset_cache.clear()


def invalidate_cache_for_municipality(
    region_id: int,
    province_id: int | None,
    municipality_id: int,
) -> None:
    """Invalidate cache for a comune (region, province, municipality_id)."""
    key_prefix = (region_id, province_id, municipality_id)
    to_remove = [
        k for k in list(_green_asset_cache) if (k[0], k[1], k[2]) == key_prefix
    ]
    for k in to_remove:
        del _green_asset_cache[k]
