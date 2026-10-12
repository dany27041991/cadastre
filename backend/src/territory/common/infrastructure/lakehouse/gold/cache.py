"""In-process gold Parquet row cache (TTL + subset hits)."""

from __future__ import annotations

import threading
import time

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.gold.constants import _GOLD_CACHE_TTL_SEC

_gold_cache_lock = threading.Lock()
_gold_cache: dict[tuple[str, tuple], tuple[float, list[tuple]]] = {}


def invalidate_gold_cache() -> None:
    """Drop in-process gold Parquet cache (call after municipality re-ingest)."""
    with _gold_cache_lock:
        _gold_cache.clear()


def _cache_key(
    resolutions: list[IngestResolution], zoom_band: str
) -> tuple[str, tuple]:
    fingerprint = tuple(
        sorted(
            (int(r.municipality_id), r.ingest_at.isoformat()) for r in resolutions
        )
    )
    return zoom_band, fingerprint


def _filter_rows_for_municipalities(
    rows: list[tuple], municipality_ids: set[int]
) -> list[tuple]:
    """Keep gold rows whose municipality_id is in the requested set."""
    if not municipality_ids:
        return []
    return [r for r in rows if int(r[3]) in municipality_ids]


def _lookup_gold_cache(
    resolutions: list[IngestResolution], zoom_band: str, now: float
) -> tuple[list[tuple] | None, str]:
    """Exact or subset cache hit.

    Zooming Italy→region used to miss when the pruned municipality set shrank
    by one id (forced a fresh multi-second MinIO read).
    """
    key = _cache_key(resolutions, zoom_band)
    with _gold_cache_lock:
        hit = _gold_cache.get(key)
        if hit is not None and (now - hit[0]) <= _GOLD_CACHE_TTL_SEC:
            return list(hit[1]), "exact"

        # Subset hits must match (municipality_id, ingest_at), not municipality
        # alone — otherwise a warm 2024 national cache is reused for a 2023
        # date window (same comune ids, wrong snapshot counts / empty silver).
        wanted_pairs = {
            (int(r.municipality_id), r.ingest_at.isoformat()) for r in resolutions
        }
        wanted_ids = {mid for mid, _ingest in wanted_pairs}
        best: tuple[float, list[tuple], int] | None = None
        for (band, fingerprint), (ts, rows) in _gold_cache.items():
            if band != zoom_band or (now - ts) > _GOLD_CACHE_TTL_SEC:
                continue
            cached_pairs = {(int(mid), ingest) for mid, ingest in fingerprint}
            if not wanted_pairs <= cached_pairs:
                continue
            if best is None or len(cached_pairs) < best[2]:
                best = (ts, rows, len(cached_pairs))
        if best is not None:
            return _filter_rows_for_municipalities(best[1], wanted_ids), "subset"
    return None, "miss"


def _store_gold_cache(
    resolutions: list[IngestResolution], zoom_band: str, rows: list[tuple]
) -> None:
    key = _cache_key(resolutions, zoom_band)
    with _gold_cache_lock:
        _gold_cache[key] = (time.monotonic(), rows)
        if len(_gold_cache) > 96:
            oldest = sorted(_gold_cache.items(), key=lambda kv: kv[1][0])[:16]
            for old_key, _ in oldest:
                _gold_cache.pop(old_key, None)
