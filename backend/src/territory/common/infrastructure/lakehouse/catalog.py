"""Resolve max(ingest_at) per municipality within a date range from the lakehouse catalog."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Literal

from core.config import settings
from territory.common.infrastructure.lakehouse.duckdb_client import (
    catalog_uri,
    connect_lakehouse,
)

DatasetName = Literal["assets", "areas"]


@dataclass(frozen=True)
class IngestResolution:
    municipality_id: int
    region_id: int
    province_id: int
    dataset: DatasetName
    ingest_at: date
    object_prefix: str


_cache_lock = threading.Lock()
_catalog_cache: tuple[float, list[dict]] | None = None


def _load_catalog_rows() -> list[dict]:
    global _catalog_cache
    ttl = max(0, int(settings.lakehouse_catalog_cache_ttl_sec))
    now = time.monotonic()
    with _cache_lock:
        if _catalog_cache is not None and (now - _catalog_cache[0]) <= ttl:
            return _catalog_cache[1]

    con = connect_lakehouse()
    try:
        uri = catalog_uri()
        rows = con.execute(
            f"""
            SELECT municipality_id, region_id, province_id, dataset, ingest_at, object_prefix
            FROM read_parquet('{uri}')
            """
        ).fetchall()
    finally:
        con.close()

    parsed: list[dict] = []
    for municipality_id, region_id, province_id, dataset, ingest_at, object_prefix in rows:
        parsed.append(
            {
                "municipality_id": int(municipality_id),
                "region_id": int(region_id),
                "province_id": int(province_id),
                "dataset": str(dataset),
                "ingest_at": ingest_at if isinstance(ingest_at, date) else date.fromisoformat(str(ingest_at)),
                "object_prefix": str(object_prefix),
            }
        )
    with _cache_lock:
        _catalog_cache = (now, parsed)
    return parsed


def invalidate_catalog_cache() -> None:
    global _catalog_cache
    with _cache_lock:
        _catalog_cache = None


def resolve_latest_ingests(
    *,
    dataset: DatasetName,
    date_from: date,
    date_to: date,
    municipality_ids: Iterable[int] | None = None,
) -> list[IngestResolution]:
    """For each municipality, pick max(ingest_at) in [date_from, date_to]."""
    if date_from > date_to:
        return []

    allowed = set(municipality_ids) if municipality_ids is not None else None
    best: dict[int, IngestResolution] = {}

    for row in _load_catalog_rows():
        if row["dataset"] != dataset:
            continue
        mid = row["municipality_id"]
        if allowed is not None and mid not in allowed:
            continue
        ingest_at: date = row["ingest_at"]
        if ingest_at < date_from or ingest_at > date_to:
            continue
        current = best.get(mid)
        if current is None or ingest_at > current.ingest_at:
            best[mid] = IngestResolution(
                municipality_id=mid,
                region_id=row["region_id"],
                province_id=row["province_id"],
                dataset=dataset,  # type: ignore[arg-type]
                ingest_at=ingest_at,
                object_prefix=row["object_prefix"],
            )

    return sorted(best.values(), key=lambda r: r.municipality_id)
