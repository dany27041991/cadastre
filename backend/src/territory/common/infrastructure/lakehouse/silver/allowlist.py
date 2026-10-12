"""Allowlist logic for filtering municipalities by gold presence counts."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

from .bounded_cache import new_allowlist_cache
from .constants import _ALLOWLIST_TTL_SEC, _FILTER_DENSE_FLOOR

if TYPE_CHECKING:
    from territory.common.infrastructure.lakehouse.catalog import IngestResolution

_allowlist_lock = threading.Lock()
# Key: (resolutions_fingerprint, floor) — fingerprint includes ingest_at.
_allowlist_mid_cache = new_allowlist_cache(_ALLOWLIST_TTL_SEC)


def _is_areas_roots_only_where(where_sql: str) -> bool:
    """True when table where is default roots-only (no q / drill / allowlist)."""
    normalized = " ".join(where_sql.split())
    return normalized in {
        "1=1 AND parent_id IS NULL",
        "parent_id IS NULL",
    }


def _muni_counts_from_gold(
    resolutions: list[IngestResolution],
    where_sql: str,
    *,
    require_complete: bool = True,
) -> dict[int, int] | None:
    """Per-municipality counts from gold when ``where_sql`` matches gold semantics.

    When ``require_complete`` is True (exact skip for unfiltered totals), returns None
    if any resolution municipality is missing from gold. When False (presence / filter
    prioritization), returns a partial map — missing munis default to 0 at the caller.
    """
    try:
        from territory.common.infrastructure.lakehouse import gold_read

        if where_sql == "1=1":
            rows = gold_read._read_admin_municipality_band_rows(resolutions)
        elif _is_areas_roots_only_where(where_sql):
            rows = gold_read._read_admin_areas_stats_band_rows(resolutions)
        else:
            return None
    except Exception:
        return None
    if not rows:
        return None
    counts: dict[int, int] = {}
    for r in rows:
        mid = int(r[3])
        counts[mid] = counts.get(mid, 0) + int(r[6] or 0)
    needed = {int(r.municipality_id) for r in resolutions}
    if require_complete:
        if not needed.issubset(counts.keys()):
            return None
        return {mid: int(counts[mid]) for mid in needed}
    return {mid: int(counts[mid]) for mid in needed if mid in counts}


def _gold_presence_where(where_sql: str) -> str:
    """Unfiltered gold where used only to skip empty municipalities under a stricter filter.

    Product filters (ILIKE / enums) invalidate exact gold skip; presence still lets us
    avoid opening silver parquet for municipalities with zero roots/assets.
    """
    if _is_areas_roots_only_where(where_sql) or "parent_id IS NULL" in where_sql:
        return "1=1 AND parent_id IS NULL"
    return "1=1"


def _non_stub_allowlist(
    resolutions: list[IngestResolution],
    presence_counts: dict[int, int],
    *,
    floor: int | None = None,
) -> list[IngestResolution]:
    """Municipalities with gold presence above floor (cached mid set, TTL)."""
    # Late import to access potentially-patched cache through silver_read
    from territory.common.infrastructure.lakehouse import silver_read
    from .sql import _resolutions_fingerprint

    if floor is None:
        floor = _FILTER_DENSE_FLOOR

    # Period-aware: same muni ids + different ingest_at must not share denseness.
    scope_key = (_resolutions_fingerprint(resolutions), int(floor))
    with silver_read._allowlist_lock:
        if scope_key in silver_read._allowlist_mid_cache:
            mids = silver_read._allowlist_mid_cache[scope_key]
        else:
            mids = tuple(
                sorted(
                    int(r.municipality_id)
                    for r in resolutions
                    if int(presence_counts.get(int(r.municipality_id), 0)) > floor
                )
            )
            silver_read._allowlist_mid_cache[scope_key] = mids
    mid_set = set(mids)
    return [r for r in resolutions if int(r.municipality_id) in mid_set]
