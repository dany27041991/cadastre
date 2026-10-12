"""Count cache and wide count/total resolution logic."""

from __future__ import annotations

import hashlib
import threading
from typing import TYPE_CHECKING, Literal

from .bounded_cache import new_table_count_cache
from .constants import _TABLE_COUNT_TTL_SEC

if TYPE_CHECKING:
    from territory.common.infrastructure.lakehouse.catalog import IngestResolution

_table_count_lock = threading.Lock()
_table_count_cache = new_table_count_cache(_TABLE_COUNT_TTL_SEC)
_table_count_inflight: set[tuple[str, str]] = set()


def _count_cache_key(where_sql: str, fingerprint: str) -> tuple[str, str]:
    # Bound key RAM: full WHERE can be long with many ILIKE clauses.
    w = where_sql if len(where_sql) <= 240 else hashlib.sha1(where_sql.encode()).hexdigest()
    return (w, fingerprint)


def _count_cache_get(where_sql: str, fingerprint: str) -> int | None:
    key = _count_cache_key(where_sql, fingerprint)
    with _table_count_lock:
        if key in _table_count_cache:
            return int(_table_count_cache[key])
    return None


def _wide_count(
    resolutions: list[IngestResolution],
    where_sql: str,
    *,
    stub: Literal["assets", "areas"] | None = None,
) -> int:
    """Exact COUNT(*) by summing municipality chunks (avoids one mega-query)."""
    from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse

    from .constants import _TABLE_COUNT_CHUNK
    from .sql import _files_sql_for, _resolutions_fingerprint

    fingerprint = _resolutions_fingerprint(resolutions)
    cached = _count_cache_get(where_sql, fingerprint)
    if cached is not None:
        return cached

    ordered = sorted(
        resolutions,
        key=lambda r: (int(r.municipality_id), int(r.region_id), int(r.province_id)),
    )
    total = 0
    con = connect_lakehouse()
    try:
        for i in range(0, len(ordered), _TABLE_COUNT_CHUNK):
            chunk = ordered[i : i + _TABLE_COUNT_CHUNK]
            files_sql = _files_sql_for(chunk, stub=stub)
            n = con.execute(
                f"""
                SELECT count(*) FROM read_parquet([{files_sql}], union_by_name=true)
                WHERE {where_sql}
                """
            ).fetchone()[0]
            total += int(n)
    finally:
        con.close()

    with _table_count_lock:
        _table_count_cache[_count_cache_key(where_sql, fingerprint)] = total
    return total


def _schedule_wide_count(
    resolutions: list[IngestResolution],
    where_sql: str,
    *,
    stub: Literal["assets", "areas"] | None = None,
) -> None:
    """Fill exact total cache without blocking the HTTP response."""
    from .sql import _resolutions_fingerprint

    fingerprint = _resolutions_fingerprint(resolutions)
    key = _count_cache_key(where_sql, fingerprint)
    if _count_cache_get(where_sql, fingerprint) is not None:
        return
    with _table_count_lock:
        if key in _table_count_inflight:
            return
        _table_count_inflight.add(key)

    def _run() -> None:
        try:
            _wide_count(resolutions, where_sql, stub=stub)
        except Exception:
            pass
        finally:
            with _table_count_lock:
                _table_count_inflight.discard(key)

    threading.Thread(target=_run, daemon=True, name="lakehouse-table-count").start()


def _asset_total_from_gold(resolutions: list[IngestResolution]) -> int | None:
    """Unfiltered asset total from municipality gold (same ingest set as silver)."""
    try:
        from territory.common.infrastructure.lakehouse import gold_read

        rows = gold_read._read_admin_municipality_band_rows(resolutions)
    except Exception:
        return None
    if not rows:
        return None
    return sum(int(r[6] or 0) for r in rows)


def _area_total_from_gold(resolutions: list[IngestResolution]) -> int | None:
    """Root areas total (parent_id IS NULL) from green_areas_stats gold."""
    try:
        from territory.common.infrastructure.lakehouse import gold_read

        rows = gold_read._read_admin_areas_stats_band_rows(resolutions)
    except Exception:
        return None
    if not rows:
        return None
    return sum(int(r[6] or 0) for r in rows)


def _resolve_wide_total(
    resolutions: list[IngestResolution],
    *,
    where_sql: str,
    offset: int,
    row_count: int,
    page_size: int,
    prefer_gold: bool,
    stub: Literal["assets", "areas"] | None = None,
) -> tuple[int, str]:
    """Return (total, source) without blocking on a cold national COUNT."""
    # Late import to avoid circular dependency, enables test monkeypatching through silver_read
    from territory.common.infrastructure.lakehouse import silver_read

    from .allowlist import _gold_presence_where, _is_areas_roots_only_where, _muni_counts_from_gold, _non_stub_allowlist
    from .constants import _TABLE_SINGLE_SHOT_MAX
    from .sql import _has_more_total, _resolutions_fingerprint

    fingerprint = _resolutions_fingerprint(resolutions)
    cached = _count_cache_get(where_sql, fingerprint)
    if cached is not None:
        return cached, "cache"
    if prefer_gold:
        gold_total: int | None = None
        if where_sql == "1=1":
            gold_total = silver_read._asset_total_from_gold(resolutions)
        elif _is_areas_roots_only_where(where_sql):
            gold_total = silver_read._area_total_from_gold(resolutions)
        if gold_total is not None:
            # TTLCache stores the value only (TTL is internal). Do NOT store
            # (monotonic, total) tuples — that left NameError + broke int() get
            # after bounded_cache migration (debug 4fe799 national table empty).
            with _table_count_lock:
                _table_count_cache[_count_cache_key(where_sql, fingerprint)] = (
                    gold_total
                )
            return gold_total, "gold"
    attribute_filtered = not (
        where_sql == "1=1" or _is_areas_roots_only_where(where_sql)
    )
    # Filtered search: sync COUNT only on small allowlists (oneshot-sized).
    # National presence>0 (~7.9k munis) sync COUNT measured ~80s+ — schedule
    # background + has_more approx so Cerca stays responsive.
    if attribute_filtered:
        presence = _muni_counts_from_gold(
            resolutions,
            _gold_presence_where(where_sql),
            require_complete=False,
        )
        count_res = resolutions
        if presence is not None:
            nonempty = [
                r
                for r in resolutions
                if presence.get(int(r.municipality_id), 0) > 0
            ]
            allow = _non_stub_allowlist(nonempty, presence)
            if allow:
                count_res = allow
        if count_res and len(count_res) <= _TABLE_SINGLE_SHOT_MAX:
            try:
                exact = _wide_count(count_res, where_sql, stub=stub)
                return exact, "count"
            except Exception:
                pass
        if count_res:
            silver_read._schedule_wide_count(count_res, where_sql, stub=stub)
            return _has_more_total(offset, row_count, page_size), "approx"
    silver_read._schedule_wide_count(resolutions, where_sql, stub=stub)
    return _has_more_total(offset, row_count, page_size), "approx"
