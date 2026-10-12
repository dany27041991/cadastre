#!/usr/bin/env python3
"""Backfill silver V1.1 filter columns with deterministic mock values.

National (and older) municipality parts were written before V1.1; DuckDB
``union_by_name`` fills missing cols with NULL → FE ``NaN``. Lecce city
ingests that already have non-null V1.1 values are left untouched.

Usage (host, MinIO on :9000):
  LAKEHOUSE_S3_ENDPOINT=http://localhost:9000 \\
    python backfill_v11_mock_attrs.py

  python backfill_v11_mock_attrs.py --dry-run
  python backfill_v11_mock_attrs.py --latest-only

Env: LAKEHOUSE_S3_* (same as lakehouse_writer).
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow as pa

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lakehouse_writer import (  # noqa: E402
    CATALOG_KEY,
    bucket_name,
    get_bytes,
    hive_prefix,
    load_catalog_table,
    put_bytes,
    read_parquet_bytes,
    s3_client,
    table_to_parquet_bytes,
)
from silver_schema import (  # noqa: E402
    AREA_COLUMN_TYPES,
    ASSET_COLUMN_TYPES,
    ensure_areas_table,
    ensure_assets_table,
)

AREA_V11 = (
    "zril_identifier",
    "istat_classification",
    "intensity_of_fruition",
    "perimeter_type",
    "surface_area_m2",
    "survey_date",
)
ASSET_V11 = (
    "species_code",
    "trunk_diameter_cm",
    "plant_height_m",
    "crown_diameter_m",
    "growth_stage",
    "protection_status",
    "health_status",
    "survey_date",
)

_ISTAT = ("URBAN_PARKS", "EQUIPPED_GREEN", "URBAN_FURNISHING", "OTHER")
_INTENSITY = ("NONE", "LOW", "MEDIUM", "HIGH")
_PERIMETER = ("REAL", "FICTITIOUS")
_GROWTH = ("YOUNG", "SEMI_MATURE", "MATURE", "OVERMATURE")
_PROT = ("NONE", "PROTECTED", "MONUMENTAL", "HISTORICAL")
_HEALTH = ("UNKNOWN", "HEALTHY", "DEGRADED", "DECLINING", "SICK")
_SURVEY_TS = pa.timestamp("us", tz="UTC")

def _mock_survey_dates(ids: list[Any], n: int) -> list[datetime]:
    return [
        datetime(
            2018 + ((ids[i] or i) % 7),
            1 + ((ids[i] or i) % 12),
            1 + ((ids[i] or i) % 28),
            tzinfo=timezone.utc,
        )
        for i in range(n)
    ]

def _needs_fill(table: pa.Table, cols: tuple[str, ...]) -> bool:
    names = set(table.column_names)
    for c in cols:
        if c not in names:
            return True
        if table.column(c).null_count > 0:
            return True
    return False

def _fill_nulls(existing: list[Any], generated: list[Any]) -> list[Any]:
    out: list[Any] = []
    for old, new in zip(existing, generated):
        if old is None or old == "":
            out.append(new)
        else:
            out.append(old)
    return out

def fill_areas_v11(table: pa.Table) -> pa.Table:
    table = ensure_areas_table(table)
    n = table.num_rows
    if n == 0 or not _needs_fill(table, AREA_V11):
        return table
    ids = table.column("id").to_pylist()
    mids = table.column("municipality_id").to_pylist()
    area_cls = table.column("area_classification").to_pylist()
    rng = random.Random(0xA11EA5)

    zril = [
        f"ZRIL-{mids[i]}-{ids[i]}" if ids[i] is not None else f"ZRIL-{mids[i]}-{i}"
        for i in range(n)
    ]
    istat = [
        (area_cls[i] if area_cls[i] else _ISTAT[i % len(_ISTAT)]) for i in range(n)
    ]
    intensity = [_INTENSITY[(ids[i] or i) % len(_INTENSITY)] for i in range(n)]
    perimeter = [_PERIMETER[(ids[i] or i) % len(_PERIMETER)] for i in range(n)]
    surface = [float(500.0 + ((ids[i] or i) % 495) * 100.0) for i in range(n)]
    # slight jitter so not fully uniform
    surface = [s + rng.random() for s in surface]

    arrays = {name: table.column(name) for name in table.column_names}
    arrays["zril_identifier"] = pa.array(
        _fill_nulls(table.column("zril_identifier").to_pylist(), zril), type=pa.string()
    )
    arrays["istat_classification"] = pa.array(
        _fill_nulls(table.column("istat_classification").to_pylist(), istat),
        type=pa.string(),
    )
    arrays["intensity_of_fruition"] = pa.array(
        _fill_nulls(table.column("intensity_of_fruition").to_pylist(), intensity),
        type=pa.string(),
    )
    arrays["perimeter_type"] = pa.array(
        _fill_nulls(table.column("perimeter_type").to_pylist(), perimeter),
        type=pa.string(),
    )
    arrays["surface_area_m2"] = pa.array(
        _fill_nulls(table.column("surface_area_m2").to_pylist(), surface),
        type=pa.float64(),
    )
    arrays["survey_date"] = pa.array(
        _fill_nulls(table.column("survey_date").to_pylist(), _mock_survey_dates(ids, n)),
        type=_SURVEY_TS,
    )
    return pa.table(arrays, schema=pa.schema([(n, AREA_COLUMN_TYPES[n]) for n in AREA_COLUMN_TYPES]))

def fill_assets_v11(table: pa.Table) -> pa.Table:
    table = ensure_assets_table(table)
    n = table.num_rows
    if n == 0 or not _needs_fill(table, ASSET_V11):
        return table
    ids = table.column("id").to_pylist()
    genus = table.column("genus").to_pylist()
    species = table.column("species").to_pylist()

    species_code = []
    for i in range(n):
        g = (genus[i] or "X")[:3].upper()
        s = (species[i] or "Y")[:3].upper()
        species_code.append(f"{g}{s}")
    trunk = [float(8.0 + ((ids[i] or i) % 72)) for i in range(n)]
    height = [float(2.0 + ((ids[i] or i) % 23)) for i in range(n)]
    crown = [float(1.0 + ((ids[i] or i) % 14)) for i in range(n)]
    growth = [_GROWTH[(ids[i] or i) % len(_GROWTH)] for i in range(n)]
    prot = [_PROT[(ids[i] or i) % len(_PROT)] for i in range(n)]
    health = [_HEALTH[(ids[i] or i) % len(_HEALTH)] for i in range(n)]

    arrays = {name: table.column(name) for name in table.column_names}
    arrays["species_code"] = pa.array(
        _fill_nulls(table.column("species_code").to_pylist(), species_code),
        type=pa.string(),
    )
    arrays["trunk_diameter_cm"] = pa.array(
        _fill_nulls(table.column("trunk_diameter_cm").to_pylist(), trunk),
        type=pa.float64(),
    )
    arrays["plant_height_m"] = pa.array(
        _fill_nulls(table.column("plant_height_m").to_pylist(), height),
        type=pa.float64(),
    )
    arrays["crown_diameter_m"] = pa.array(
        _fill_nulls(table.column("crown_diameter_m").to_pylist(), crown),
        type=pa.float64(),
    )
    arrays["growth_stage"] = pa.array(
        _fill_nulls(table.column("growth_stage").to_pylist(), growth), type=pa.string()
    )
    arrays["protection_status"] = pa.array(
        _fill_nulls(table.column("protection_status").to_pylist(), prot), type=pa.string()
    )
    arrays["health_status"] = pa.array(
        _fill_nulls(table.column("health_status").to_pylist(), health), type=pa.string()
    )
    arrays["survey_date"] = pa.array(
        _fill_nulls(table.column("survey_date").to_pylist(), _mock_survey_dates(ids, n)),
        type=_SURVEY_TS,
    )
    return pa.table(
        arrays, schema=pa.schema([(n, ASSET_COLUMN_TYPES[n]) for n in ASSET_COLUMN_TYPES])
    )

def _latest_only_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[tuple[int, str], dict[str, Any]] = {}
    for r in rows:
        key = (int(r["municipality_id"]), str(r["dataset"]))
        prev = best.get(key)
        if prev is None or r["ingest_at"] > prev["ingest_at"]:
            best[key] = r
    return list(best.values())

def backfill(client, *, dry_run: bool = False, latest_only: bool = False) -> int:
    catalog = load_catalog_table(client)
    if catalog.num_rows == 0:
        print(f"Empty catalog s3://{bucket_name()}/{CATALOG_KEY}")
        return 0
    rows = [
        r
        for r in catalog.to_pylist()
        if r.get("dataset") in ("assets", "areas") and int(r.get("region_id") or 0) != 999
    ]
    if latest_only:
        rows = _latest_only_rows(rows)
    print(
        f"Backfill V1.1 mock attrs: candidates={len(rows)} "
        f"dry_run={dry_run} latest_only={latest_only}",
        flush=True,
    )

    written = 0
    skipped = 0
    missing = 0
    for i, r in enumerate(rows):
        dataset = str(r["dataset"])
        prefix = hive_prefix(
            dataset,
            int(r["region_id"]),
            int(r["province_id"]),
            int(r["municipality_id"]),
            r["ingest_at"],
        )
        key = f"{prefix}/part-000.parquet"
        raw = get_bytes(client, key)
        if raw is None:
            missing += 1
            continue
        table = read_parquet_bytes(raw)
        v11 = ASSET_V11 if dataset == "assets" else AREA_V11
        if not _needs_fill(table, v11):
            skipped += 1
            continue
        filled = fill_assets_v11(table) if dataset == "assets" else fill_areas_v11(table)
        if dry_run:
            written += 1
        else:
            # Direct put — skip catalog upsert (same prefix/row_count; avoids O(n²) rewrites)
            put_bytes(client, key, table_to_parquet_bytes(filled))
            written += 1
        if (i + 1) % 100 == 0 or written % 50 == 0:
            print(
                f"  … scanned={i + 1}/{len(rows)} written={written} "
                f"skipped={skipped} missing={missing}",
                flush=True,
            )

    print(
        f"Done written={written} skipped_ok={skipped} missing_silver={missing}",
        flush=True,
    )
    return written

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Count parts that need fill")
    parser.add_argument(
        "--latest-only",
        action="store_true",
        help="Only latest ingest_at per municipality+dataset",
    )
    args = parser.parse_args()
    client = s3_client()
    backfill(client, dry_run=args.dry_run, latest_only=args.latest_only)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
