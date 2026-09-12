#!/usr/bin/env python3
"""Backfill green_areas_stats from existing silver areas + admin rollup.

For each catalog row with dataset=areas (latest ingest per municipality), read
silver green_areas part, build municipality-band root counts, write stats part,
then run admin rollup.

Usage (host, MinIO on :9000):
  LAKEHOUSE_S3_ENDPOINT=http://localhost:9000 \\
    python backfill_areas_stats.py

Env: LAKEHOUSE_S3_* (same as lakehouse_writer).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from areas_stats import build_areas_municipality_band  # noqa: E402
from lakehouse_writer import (  # noqa: E402
    CATALOG_KEY,
    bucket_name,
    get_bytes,
    hive_prefix,
    load_catalog_table,
    read_parquet_bytes,
    s3_client,
    write_areas_stats_part,
)
from rollup_admin_areas_stats import (  # noqa: E402
    _latest_area_resolutions,
    rollup,
)


def _read_silver_areas(client, resolution: dict):
    prefix = hive_prefix(
        "areas",
        resolution["region_id"],
        resolution["province_id"],
        resolution["municipality_id"],
        resolution["ingest_at"],
    )
    key = f"{prefix}/part-000.parquet"
    raw = get_bytes(client, key)
    if raw is None:
        return None
    return read_parquet_bytes(raw)


def backfill(client) -> int:
    catalog = load_catalog_table(client)
    if catalog.num_rows == 0:
        print(f"Empty catalog s3://{bucket_name()}/{CATALOG_KEY}")
        return 0
    resolutions = _latest_area_resolutions(catalog)
    print(f"Backfilling areas_stats for {len(resolutions)} municipalities…")
    written = 0
    missing = 0
    for res in resolutions:
        areas = _read_silver_areas(client, res)
        if areas is None:
            missing += 1
            continue
        band = build_areas_municipality_band(
            areas,
            region_id=res["region_id"],
            province_id=res["province_id"],
            municipality_id=res["municipality_id"],
        )
        key = write_areas_stats_part(
            client,
            region_id=res["region_id"],
            province_id=res["province_id"],
            municipality_id=res["municipality_id"],
            ingest_date=res["ingest_at"],
            table=band,
        )
        written += 1
        if written % 50 == 0:
            print(f"  … {written}/{len(resolutions)} (last {key})")
    print(f"Stats parts written={written} missing_silver={missing}")
    print("Running admin areas-stats rollup…")
    rollup(client)
    return written


def main() -> int:
    client = s3_client()
    backfill(client)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
