"""Cache with maximum compression for large geospatial payloads (GeoJSON)."""

import lzma
import pickle
from typing import Any

from cachetools import LRUCache, TTLCache

# Maximum compression level for lzma (best ratio, slower)
_LZMA_PRESET = 9


def _compress(value: Any) -> bytes:
    return lzma.compress(
        pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL),
        preset=_LZMA_PRESET,
    )


def _decompress(data: bytes) -> Any:
    return pickle.loads(lzma.decompress(data))


class CompressedTTLCache(TTLCache):
    """
    TTLCache with maximum compression (lzma) for administrative areas
    (regions, provinces, municipalities, sub-municipal). Values expire by TTL.
    """

    def __setitem__(self, key: Any, value: Any) -> None:
        super().__setitem__(key, _compress(value))

    def __getitem__(self, key: Any) -> Any:
        return _decompress(super().__getitem__(key))


class CompressedLRUCache(LRUCache):
    """
    LRUCache with maximum compression (lzma). No expiration; eviction by maxsize only.
    Used for green areas/assets catalogs.
    """

    def __setitem__(self, key: Any, value: Any) -> None:
        super().__setitem__(key, _compress(value))

    def __getitem__(self, key: Any) -> Any:
        return _decompress(super().__getitem__(key))
