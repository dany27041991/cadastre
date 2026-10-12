"""Resolve matching areas for product filters."""

from __future__ import annotations

import concurrent.futures
import threading
import time
from datetime import date
from typing import TYPE_CHECKING, Any, Literal

from .allowlist import _muni_counts_from_gold, _non_stub_allowlist
from .bounded_cache import (
    MATCH_AREAS_VALUE_MAX,
    catalog_window_key,
    filter_cache_key,
    new_match_areas_cache,
    new_match_muni_cache,
)
from .constants import _TABLE_SINGLE_SHOT_MAX, _TABLE_WIDE_CHUNK
from .sql import _files_sql_for, _resolutions_fingerprint as _sql_resolutions_fingerprint

if TYPE_CHECKING:
    from territory.common.infrastructure.lakehouse.catalog import IngestResolution

# Primary: single-flight. Secondary: small TTLCache (see bounded_cache.py).
_match_muni_lock = threading.Lock()
_match_muni_cache = new_match_muni_cache()
_match_muni_inflight: dict[tuple[str, str], threading.Event] = {}

_match_areas_lock = threading.Lock()
_match_areas_cache = new_match_areas_cache()
_match_areas_inflight: dict[
    tuple[str, str, int], tuple[threading.Event, list[tuple[int, int]] | None]
] = {}
_MATCH_AREAS_SCAN_LOCK = threading.Lock()

# TTLCache.get(None) cannot mean miss — probe_wide uses an explicit sentinel.
_PROBE_WIDE: object = object()

# After dense-first hits, stop when this many consecutive chunks return empty.
_EMPTY_CHUNK_STOP = 3
# Sparse probe hits (e.g. name=villa → 1 muni): one empty confirm chunk is
# enough — 3× sequential empties were ~4.5–6s of the 7s wall (debug 4fe799).
_EMPTY_CHUNK_STOP_SPARSE = 1
_SPARSE_FOUND_MAX = 20

# Parallel DISTINCT workers (each opens its own DuckDB connection).
# Cap below pool size so table+viewport still get slots (debug 4fe799:
# workers=8 + pool=8 → duckdb_pool_exhausted during 2nd Cerca).
_MATCH_MUNI_WORKERS = 2
_MATCH_MUNI_CHUNK = 400

# First dense chunk: if this many munis hit, treat filter as near-national and
# skip the full 7.9k scan (Area boost log: 6250 munis / 50k area ids ≈ 57s).
_WIDESPREAD_PROBE_MIN_MUNIS = 80

MatchMunisMode = Literal[
    "cache",
    "probe_wide",
    "full",
    "early_stop",
    "early_stop_empty",
    "empty",
    "oneshot",
]


def _resolutions_fingerprint(
    resolutions: list[IngestResolution],
    *,
    wide: bool,
) -> str:
    """Full muni:ingest snapshot + widespread flag."""
    return f"{_sql_resolutions_fingerprint(resolutions)}|wide={int(wide)}"


def _match_scope_key(
    filters: dict[str, Any],
    resolutions: list[IngestResolution],
    *,
    wide: bool,
    date_from: date | None,
    date_to: date | None,
) -> tuple[str, str]:
    """Compact key: filters + requested window + resolutions fingerprint.

    Overlapping catalog windows differ on ``catalog_window_key`` even when some
    municipalities share the same ``max(ingest_at)``.
    """
    return (
        filter_cache_key(filters),
        f"{catalog_window_key(date_from, date_to)}|{_resolutions_fingerprint(resolutions, wide=wide)}",
    )


def _log_match_munis_done(data: dict[str, Any], *, hypothesis_id: str) -> None:
    # #region agent log
    try:
        import json as _json
        import urllib.request as _urlreq

        _payload = _json.dumps(
            {
                "sessionId": "4fe799",
                "runId": "perf-opt",
                "hypothesisId": hypothesis_id,
                "location": "silver.matching_areas:resolve_matching_municipality_ids",
                "message": "match_munis_done",
                "data": data,
                "timestamp": int(time.time() * 1000),
            }
        ).encode("utf-8")
        _urlreq.urlopen(
            _urlreq.Request(
                "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                data=_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Debug-Session-Id": "4fe799",
                },
                method="POST",
            ),
            timeout=1.5,
        )
    except Exception:
        pass
    # #endregion


def _ordered_candidates(
    resolutions: list[IngestResolution],
    filters: dict[str, Any],
) -> tuple[list[IngestResolution], dict[int, int] | None, str]:
    from territory.common.infrastructure.lakehouse.table_filters import (
        area_filter_where,
    )

    clauses = ["parent_id IS NULL", *area_filter_where(filters)]
    if len(clauses) <= 1:
        return [], None, ""
    where_sql = " AND ".join(clauses)

    presence = _muni_counts_from_gold(
        resolutions,
        "1=1 AND parent_id IS NULL",
        require_complete=False,
    )
    candidates = list(resolutions)
    if presence is not None:
        allowlist = _non_stub_allowlist(
            [r for r in resolutions if presence.get(int(r.municipality_id), 0) > 0],
            presence,
        )
        candidates = allowlist
    if not candidates:
        return [], presence, where_sql
    if presence is not None:
        ordered = sorted(
            candidates,
            key=lambda r: (
                -int(presence.get(int(r.municipality_id), 0)),
                int(r.municipality_id),
            ),
        )
    else:
        ordered = sorted(
            candidates,
            key=lambda r: (
                int(r.municipality_id),
                int(r.region_id),
                int(r.province_id),
            ),
        )
    return ordered, presence, where_sql


def _distinct_munis_chunk(
    chunk: list[IngestResolution], where_sql: str
) -> list[int]:
    from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse

    if not chunk:
        return []
    files_sql = _files_sql_for(chunk, stub="areas")
    con = connect_lakehouse()
    try:
        rows = con.execute(
            f"""
            SELECT DISTINCT municipality_id
            FROM read_parquet([{files_sql}], union_by_name=true)
            WHERE {where_sql}
            """
        ).fetchall()
    finally:
        con.close()
    out: list[int] = []
    for r in rows:
        if r[0] is not None:
            out.append(int(r[0]))
    return out


def resolve_matching_municipality_ids(
    resolutions: list[IngestResolution],
    filters: dict[str, Any] | None,
    *,
    allow_widespread_shortcircuit: bool = True,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[int] | None, MatchMunisMode]:
    """Municipality ids with ≥1 root area matching filters.

    Returns ``(munis, mode)``:
    - ``([], "empty")`` — no matches
    - ``(None, "probe_wide")`` — near-national hit rate; caller should **not**
      scope gold (full admin ladder). Avoids ~57s full scan (debug: 50k area
      ids / 6250 munis for Area boost).
    - ``([ids...], ...)`` — scope clusters to these munis

    Selective filters still run a parallel DISTINCT over remaining chunks.

    ``date_from`` / ``date_to`` (catalog window) are part of the cache key so
    overlapping temporal searches never coalesce or reuse each other.
    """
    if not resolutions or not filters:
        return [], "empty"

    from territory.common.infrastructure.lakehouse.table_filters import (
        area_filters_are_selective,
    )

    # area_code / ZRIL must not take the widespread short-circuit (unscoped gold).
    if area_filters_are_selective(filters):
        allow_widespread_shortcircuit = False

    cache_key = _match_scope_key(
        filters,
        resolutions,
        wide=allow_widespread_shortcircuit,
        date_from=date_from,
        date_to=date_to,
    )
    with _match_muni_lock:
        if cache_key in _match_muni_cache:
            cached = _match_muni_cache[cache_key]
            _log_match_munis_done(
                {
                    "n_munis": None if cached is _PROBE_WIDE else len(cached),
                    "ms": 0,
                    "mode": "cache",
                    "coalesced": False,
                },
                hypothesis_id="H-match-muni-cache",
            )
            if cached is _PROBE_WIDE:
                return None, "cache"
            return list(cached), "cache"
        inflight = _match_muni_inflight.get(cache_key)
        if inflight is not None:
            wait_ev = inflight
            leader = False
        else:
            wait_ev = threading.Event()
            _match_muni_inflight[cache_key] = wait_ev
            leader = True

    if not leader:
        wait_ev.wait(timeout=120.0)
        with _match_muni_lock:
            if cache_key in _match_muni_cache:
                cached2 = _match_muni_cache[cache_key]
                _log_match_munis_done(
                    {
                        "n_munis": None if cached2 is _PROBE_WIDE else len(cached2),
                        "ms": 0,
                        "mode": "cache",
                        "coalesced": True,
                    },
                    hypothesis_id="H-match-muni-coalesce",
                )
                if cached2 is _PROBE_WIDE:
                    return None, "cache"
                return list(cached2), "cache"
        return [], "empty"

    try:
        ordered, _presence, where_sql = _ordered_candidates(resolutions, filters)
        if not ordered or not where_sql:
            with _match_muni_lock:
                _match_muni_cache[cache_key] = tuple()
            return [], "empty"

        chunk_size = (
            len(ordered)
            if len(ordered) <= _TABLE_SINGLE_SHOT_MAX
            else _MATCH_MUNI_CHUNK
        )
        t0 = time.monotonic()
        chunks = [
            ordered[i : i + chunk_size] for i in range(0, len(ordered), chunk_size)
        ]

        # Probe first dense chunk — widespread filters exit here.
        probe = _distinct_munis_chunk(chunks[0], where_sql) if chunks else []
        if (
            allow_widespread_shortcircuit
            and len(chunks) > 1
            and len(probe) >= _WIDESPREAD_PROBE_MIN_MUNIS
        ):
            _log_match_munis_done(
                {
                    "n_ordered": len(ordered),
                    "chunks_scanned": 1,
                    "n_munis": None,
                    "probe_hits": len(probe),
                    "ms": int((time.monotonic() - t0) * 1000),
                    "mode": "probe_wide",
                    "coalesced": False,
                },
                hypothesis_id="H-widespread",
            )
            with _match_muni_lock:
                _match_muni_cache[cache_key] = _PROBE_WIDE
            return None, "probe_wide"

        found: set[int] = set(probe)
        chunks_scanned = 1 if chunks else 0
        rest = chunks[1:]
        stop_after_used = _EMPTY_CHUNK_STOP

        if len(ordered) <= _TABLE_SINGLE_SHOT_MAX:
            mode: MatchMunisMode = "oneshot"
        elif not rest:
            mode = "full"
        elif found:
            # Dense-first + hits: confirm with parallel waves + empty-streak stop.
            # Sequential 3×~1.5–2s empty chunks dominated cold villa (debug 4fe799).
            mode = "early_stop"
            stop_after = (
                _EMPTY_CHUNK_STOP_SPARSE
                if len(found) <= _SPARSE_FOUND_MAX
                else _EMPTY_CHUNK_STOP
            )
            stop_after_used = stop_after
            empty_streak = 0
            ri = 0
            while ri < len(rest) and empty_streak < stop_after:
                need = stop_after - empty_streak
                batch = rest[ri : ri + min(_MATCH_MUNI_WORKERS, need)]
                ri += len(batch)
                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=max(1, len(batch))
                ) as pool:
                    futs = [
                        pool.submit(_distinct_munis_chunk, ch, where_sql)
                        for ch in batch
                    ]
                    # Preserve chunk order for consecutive-empty semantics.
                    ordered_hits = [fut.result() for fut in futs]
                for hits in ordered_hits:
                    chunks_scanned += 1
                    if not hits:
                        empty_streak += 1
                        if empty_streak >= stop_after:
                            break
                        continue
                    empty_streak = 0
                    found.update(hits)
        elif not allow_widespread_shortcircuit:
            # Selective product filters + empty probe: do NOT full-scan the nation
            # (debug 4fe799: zril-127+villa → mode=full, 20 chunks ≈ 100s, n_munis=0).
            # Dense-first + empty streak ≈ "no hits in dense communes" → treat as empty.
            mode = "early_stop_empty"
            empty_streak = 0
            ri = 0
            while ri < len(rest) and empty_streak < _EMPTY_CHUNK_STOP:
                need = _EMPTY_CHUNK_STOP - empty_streak
                batch = rest[ri : ri + min(_MATCH_MUNI_WORKERS, need)]
                ri += len(batch)
                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=max(1, len(batch))
                ) as pool:
                    futs = [
                        pool.submit(_distinct_munis_chunk, ch, where_sql)
                        for ch in batch
                    ]
                    ordered_hits = [fut.result() for fut in futs]
                for hits in ordered_hits:
                    chunks_scanned += 1
                    if not hits:
                        empty_streak += 1
                        if empty_streak >= _EMPTY_CHUNK_STOP:
                            break
                        continue
                    empty_streak = 0
                    found.update(hits)
        else:
            mode = "full"
            # Parallel DISTINCT on remaining chunks (non-selective, probe empty).
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=_MATCH_MUNI_WORKERS
            ) as pool:
                futs = [
                    pool.submit(_distinct_munis_chunk, ch, where_sql) for ch in rest
                ]
                for fut in concurrent.futures.as_completed(futs):
                    chunks_scanned += 1
                    for mid in fut.result():
                        found.add(mid)

        out = sorted(found)
        _log_match_munis_done(
            {
                "n_ordered": len(ordered),
                "chunks_scanned": chunks_scanned,
                "n_munis": len(out),
                "probe_hits": len(probe),
                "ms": int((time.monotonic() - t0) * 1000),
                "mode": mode,
                "workers": _MATCH_MUNI_WORKERS,
                "stop_after": stop_after_used,
                "opt": "early_stop_parallel_sparse_v1",
                "baseline_cold_ms": 7180,
                "coalesced": False,
            },
            hypothesis_id="H-opt-match-muni",
        )

        with _match_muni_lock:
            _match_muni_cache[cache_key] = tuple(out)
        if not out:
            return [], "empty"
        return out, mode
    finally:
        with _match_muni_lock:
            _match_muni_inflight.pop(cache_key, None)
            wait_ev.set()


def resolve_matching_areas(
    resolutions: list[IngestResolution],
    filters: dict[str, Any] | None,
    *,
    limit: int = 50_000,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[tuple[int, int]]:
    """Return ``(area_id, municipality_id)`` for root areas matching product filters.

    Presence>0 allowlist; oneshot SELECT when small, else chunked walk with
    early exit after consecutive empty chunks (dense-first).

    ``date_from`` / ``date_to`` isolate overlapping catalog windows in the cache.
    Large result sets are single-flight only (not retained) to bound RAM.
    """
    if not resolutions or not filters:
        return []
    from territory.common.infrastructure.lakehouse.duckdb_client import connect_lakehouse
    from territory.common.infrastructure.lakehouse.metrics import timed_op

    scope = _match_scope_key(
        filters,
        resolutions,
        wide=False,
        date_from=date_from,
        date_to=date_to,
    )
    cache_key = (scope[0], scope[1], int(limit))
    with _match_areas_lock:
        hit = _match_areas_cache.get(cache_key)
        if hit is not None:
            # #region agent log
            try:
                import json as _json
                import urllib.request as _urlreq

                _payload = _json.dumps(
                    {
                        "sessionId": "4fe799",
                        "runId": "zoom-fast",
                        "hypothesisId": "H-match-cache",
                        "location": "silver.matching_areas:resolve_matching_areas",
                        "message": "match_areas_done",
                        "data": {
                            "cache": True,
                            "n_matches": len(hit),
                            "ms": 0,
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                ).encode("utf-8")
                _urlreq.urlopen(
                    _urlreq.Request(
                        "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                        data=_payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "4fe799",
                        },
                        method="POST",
                    ),
                    timeout=1.5,
                )
            except Exception:
                pass
            # #endregion
            return list(hit)
        inflight = _match_areas_inflight.get(cache_key)
        if inflight is not None:
            wait_ev, _prev = inflight
            leader = False
        else:
            wait_ev = threading.Event()
            _match_areas_inflight[cache_key] = (wait_ev, None)
            leader = True

    if not leader:
        wait_ev.wait(timeout=120.0)
        with _match_areas_lock:
            hit2 = _match_areas_cache.get(cache_key)
            if hit2 is not None:
                # #region agent log
                try:
                    import json as _json
                    import urllib.request as _urlreq

                    _payload = _json.dumps(
                        {
                            "sessionId": "4fe799",
                            "runId": "pool-storm",
                            "hypothesisId": "H-match-coalesce",
                            "location": "silver.matching_areas:resolve_matching_areas",
                            "message": "match_areas_done",
                            "data": {
                                "cache": True,
                                "coalesced": True,
                                "n_matches": len(hit2),
                                "ms": 0,
                            },
                            "timestamp": int(time.time() * 1000),
                        }
                    ).encode("utf-8")
                    _urlreq.urlopen(
                        _urlreq.Request(
                            "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                            data=_payload,
                            headers={
                                "Content-Type": "application/json",
                                "X-Debug-Session-Id": "4fe799",
                            },
                            method="POST",
                        ),
                        timeout=1.5,
                    )
                except Exception:
                    pass
                # #endregion
                return list(hit2)
            inflight2 = _match_areas_inflight.get(cache_key)
            if inflight2 is not None and inflight2[1] is not None:
                return list(inflight2[1])
        return []

    # Serialize heavy scans across filter keys (table + viewport + aborted Cerca).
    with _MATCH_AREAS_SCAN_LOCK:
        with _match_areas_lock:
            hit3 = _match_areas_cache.get(cache_key)
            if hit3 is not None:
                out_cached = list(hit3)
                _match_areas_inflight.pop(cache_key, None)
                wait_ev.set()
                return out_cached

        ordered, _presence, where_sql = _ordered_candidates(resolutions, filters)
        if not ordered or not where_sql:
            with _match_areas_lock:
                _match_areas_inflight.pop(cache_key, None)
            wait_ev.set()
            return []

        out: list[tuple[int, int]] = []
        chunk_size = (
            len(ordered)
            if len(ordered) <= _TABLE_SINGLE_SHOT_MAX
            else max(_TABLE_WIDE_CHUNK, 200)
        )
        empty_streak = 0
        chunks_scanned = 0
        t0 = time.monotonic()
        con = connect_lakehouse()
        try:
            with timed_op(
                "silver_resolve_matching_areas",
                municipalities=len(ordered),
                limit=limit,
            ):
                for i in range(0, len(ordered), chunk_size):
                    if len(out) >= limit:
                        break
                    chunk = ordered[i : i + chunk_size]
                    chunks_scanned += 1
                    need = limit - len(out)
                    files_sql = _files_sql_for(chunk, stub="areas")
                    rows = con.execute(
                        f"""
                        SELECT id, municipality_id
                        FROM read_parquet([{files_sql}], union_by_name=true)
                        WHERE {where_sql}
                        LIMIT {int(need)}
                        """
                    ).fetchall()
                    if not rows:
                        if out:
                            empty_streak += 1
                            if empty_streak >= _EMPTY_CHUNK_STOP:
                                break
                        continue
                    empty_streak = 0
                    for r in rows:
                        if r[0] is None or r[1] is None:
                            continue
                        out.append((int(r[0]), int(r[1])))
                        if len(out) >= limit:
                            break
        finally:
            con.close()

        with _match_areas_lock:
            # Retain only compact results; large lists stay single-flight only.
            if len(out) <= MATCH_AREAS_VALUE_MAX:
                _match_areas_cache[cache_key] = tuple(out)
            _match_areas_inflight[cache_key] = (wait_ev, list(out))
        wait_ev.set()
        with _match_areas_lock:
            _match_areas_inflight.pop(cache_key, None)

        # #region agent log
        try:
            import json as _json
            import urllib.request as _urlreq

            _payload = _json.dumps(
                {
                    "sessionId": "4fe799",
                    "runId": "perf-opt",
                    "hypothesisId": "H-opt-match-areas",
                    "location": "silver.matching_areas:resolve_matching_areas",
                    "message": "match_areas_done",
                    "data": {
                        "cache": False,
                        "coalesced": False,
                        "n_resolutions_in": len(resolutions),
                        "n_ordered": len(ordered),
                        "chunks_scanned": chunks_scanned,
                        "n_matches": len(out),
                        "ms": int((time.monotonic() - t0) * 1000),
                        "scoped_hint": len(resolutions) <= 40,
                    },
                    "timestamp": int(time.time() * 1000),
                }
            ).encode("utf-8")
            _urlreq.urlopen(
                _urlreq.Request(
                    "http://host.docker.internal:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c",
                    data=_payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "4fe799",
                    },
                    method="POST",
                ),
                timeout=1.5,
            )
        except Exception:
            pass
        # #endregion
        return out
