"""Resolve ingestion prefixes for date ranges and territory scopes."""

from __future__ import annotations

from datetime import date
from typing import Literal

from territory.common.infrastructure.lakehouse.catalog import (
    IngestResolution,
    resolve_latest_ingests,
)

DatasetName = Literal["assets", "areas"]


def resolve_prefixes(
    *,
    dataset: DatasetName,
    date_from: date | None,
    date_to: date | None,
    region_id: int | None = None,
    province_id: int | None = None,
    municipality_id: int | None = None,
    municipality_ids: list[int] | None = None,
) -> list[IngestResolution]:
    if date_from is None or date_to is None:
        return []
    ids: list[int] | None
    if municipality_id is not None:
        ids = [municipality_id]
    elif municipality_ids is not None:
        ids = list(municipality_ids)
    else:
        ids = None
    resolved = resolve_latest_ingests(
        dataset=dataset,
        date_from=date_from,
        date_to=date_to,
        municipality_ids=ids,
    )
    if region_id is not None:
        resolved = [r for r in resolved if r.region_id == region_id]
    if province_id is not None:
        resolved = [r for r in resolved if r.province_id == province_id]
    return resolved
