"""Bounded TTL caches for lakehouse serving (OOM-safe under multi-user load).

Policy
------
1. **Correctness first**: cache keys always include catalog ``date_from``/``date_to``
   and a full resolutions fingerprint (every ``muni:ingest_at``). Overlapping
   windows never share entries or single-flight slots.
2. **Single-flight** (in callers) is the primary win for concurrent identical
   Cerca (table ∥ viewport). TTL retention is only a short warm reuse.
3. **Hard maxsize + TTL** via ``cachetools.TTLCache`` — no unbounded dicts.
4. **Small values only**: never cache national GeoJSON here; match-areas skips
   caching when the pair list exceeds ``MATCH_AREAS_VALUE_MAX``.
5. Process-local only (per uvicorn worker). Cross-worker duplication is OK;
   Redis would multiply complexity without fixing DuckDB/MinIO cost.
"""

from __future__ import annotations

import hashlib
from datetime import date
from typing import TYPE_CHECKING, Any

from cachetools import TTLCache

if TYPE_CHECKING:
    from territory.common.infrastructure.lakehouse.catalog import IngestResolution

# Match scope (muni ids / area pairs) — warm for zoom + table same Cerca.
# 120s aligns with typical Cerca→zoom→pager sequences (Fase 2 plan).
MATCH_CACHE_MAXSIZE = 48
MATCH_CACHE_TTL_SEC = 120.0
# Do not retain large pair lists (viewport limit can be 50k) — coalesce only.
MATCH_AREAS_VALUE_MAX = 2_000

# Exact table COUNT background fill.
TABLE_COUNT_CACHE_MAXSIZE = 256
# Allowlist denseness mid-set.
ALLOWLIST_CACHE_MAXSIZE = 64

# Catalog drill GeoJSON (compressed) — was 2048 unbounded-TTL → OOM risk.
GREEN_CATALOG_CACHE_MAXSIZE = 256
GREEN_CATALOG_CACHE_TTL_SEC = 300.0


def filter_cache_key(filters: dict[str, Any]) -> str:
    """Compact filter identity; hash when the serialized form is large."""
    parts = [f"{k}={filters[k]!r}" for k in sorted(filters.keys())]
    raw = "|".join(parts)
    if len(raw) <= 200:
        return raw
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def catalog_window_key(
    date_from: date | None,
    date_to: date | None,
) -> str:
    """Requested catalog window only (fingerprint covers resolved ingests)."""
    return (
        f"{date_from.isoformat() if date_from else '*'}:"
        f"{date_to.isoformat() if date_to else '*'}"
    )


def new_match_muni_cache() -> TTLCache:
    return TTLCache(maxsize=MATCH_CACHE_MAXSIZE, ttl=MATCH_CACHE_TTL_SEC)


def new_match_areas_cache() -> TTLCache:
    return TTLCache(maxsize=MATCH_CACHE_MAXSIZE, ttl=MATCH_CACHE_TTL_SEC)


def new_table_count_cache(ttl_sec: float) -> TTLCache:
    return TTLCache(maxsize=TABLE_COUNT_CACHE_MAXSIZE, ttl=ttl_sec)


def new_allowlist_cache(ttl_sec: float) -> TTLCache:
    return TTLCache(maxsize=ALLOWLIST_CACHE_MAXSIZE, ttl=ttl_sec)
