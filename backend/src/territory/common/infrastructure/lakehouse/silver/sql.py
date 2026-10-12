"""SQL helpers for id-in clauses, file lists, and pagination math."""

from __future__ import annotations

import hashlib

from territory.common.infrastructure.lakehouse.catalog import IngestResolution
from territory.common.infrastructure.lakehouse.duckdb_client import parquet_glob

from .schema_stub import _schema_stub_path


def _id_in_sql(ids: list[int]) -> str | None:
    """Return ``id IN (...)`` or None when the allow-list is empty (caller should short-circuit)."""
    if not ids:
        return None
    return "id IN (" + ",".join(str(int(i)) for i in ids) + ")"


def _green_area_id_in_sql(ids: list[int]) -> str | None:
    if not ids:
        return None
    return "green_area_id IN (" + ",".join(str(int(i)) for i in ids) + ")"


def _files_sql_for(
    resolutions: list[IngestResolution],
    *,
    stub: str | None = None,
) -> str:
    from typing import Literal

    globs = [parquet_glob(r.object_prefix) for r in resolutions]
    if stub is not None:
        stub_typed: Literal["assets", "areas"] = stub  # type: ignore[assignment]
        globs = [_schema_stub_path(stub_typed)] + globs
    return ", ".join(f"'{g}'" for g in globs)


def _resolutions_fingerprint(resolutions: list[IngestResolution]) -> str:
    parts = sorted(
        f"{int(r.municipality_id)}:{r.ingest_at.isoformat()}" for r in resolutions
    )
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def _has_more_total(offset: int, row_count: int, page_size: int) -> int:
    """Pager total without a full national COUNT (*+1 signals another page)."""
    total = offset + row_count
    if row_count >= page_size:
        total += 1
    return total
