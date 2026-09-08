"""Lakehouse ops endpoints (catalog cache invalidation)."""

from __future__ import annotations

from fastapi import APIRouter

from territory.common.infrastructure.lakehouse.catalog import invalidate_catalog_cache

router = APIRouter(prefix="/lakehouse", tags=["lakehouse"])


@router.post("/catalog/invalidate")
def post_invalidate_catalog_cache() -> dict[str, str]:
    """Drop in-process catalog cache after ingest (TTL otherwise applies).

    Intended for job/CI after writing `_catalog/municipality_ingests.parquet`.
    """
    invalidate_catalog_cache()
    return {"status": "ok", "cache": "invalidated"}
