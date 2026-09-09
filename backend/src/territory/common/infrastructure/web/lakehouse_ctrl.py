"""Lakehouse ops endpoints (catalog / gold cache invalidation)."""

from __future__ import annotations

from fastapi import APIRouter

from territory.common.infrastructure.lakehouse.catalog import invalidate_catalog_cache
from territory.common.infrastructure.lakehouse.gold_read import invalidate_gold_cache
from territory.areas.application.usecases.query.cache import (
    invalidate_cache as invalidate_areas_cache,
)
from territory.assets.application.usecases.query.cache import (
    invalidate_cache as invalidate_assets_cache,
)

router = APIRouter(prefix="/lakehouse", tags=["lakehouse"])


@router.post("/catalog/invalidate")
def post_invalidate_catalog_cache() -> dict[str, str]:
    """Drop in-process lakehouse caches after ingest.

    Clears catalog resolution cache, gold Parquet row cache, and green
    areas/assets LRU caches. TTL otherwise keeps stale rows after re-seed.
    """
    invalidate_catalog_cache()
    invalidate_gold_cache()
    invalidate_areas_cache()
    invalidate_assets_cache()
    return {"status": "ok", "cache": "invalidated"}
