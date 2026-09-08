#!/usr/bin/env python3
"""Roll up per-municipality gold municipality-bands into one Parquet per region.

Reads the lakehouse catalog (latest ingest per municipality for dataset=assets),
loads each municipality gold band from MinIO, appends ``ingest_at``, and writes:

  green_assets_admin_clusters/region_id={id}/part-municipality-bands.parquet

Usage (host, MinIO on :9000):
  LAKEHOUSE_S3_ENDPOINT=http://localhost:9000 \\
    python rollup_admin_gold.py

Env: LAKEHOUSE_S3_* (same as lakehouse_writer).
"""

from __future__ import annotations

import io
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

# Allow `python rollup_admin_gold.py` from this directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from gold_clusters import GOLD_BAND_MUNICIPALITY, gold_hive_prefix  # noqa: E402
from lakehouse_writer import (  # noqa: E402
    CATALOG_KEY,
    bucket_name,
    get_bytes,
    load_catalog_table,
    s3_client,
    write_admin_region_municipality_bands,
)


def _latest_asset_resolutions(catalog: pa.Table) -> list[dict]:
    """Max ingest_at per municipality for dataset=assets."""
    best: dict[int, dict] = {}
    cols = {name: catalog.column(name).to_pylist() for name in catalog.column_names}
    n = catalog.num_rows
    for i in range(n):
        if str(cols["dataset"][i]) != "assets":
            continue
        mid = int(cols["municipality_id"][i])
        ingest = cols["ingest_at"][i]
        if not isinstance(ingest, date):
            ingest = date.fromisoformat(str(ingest)[:10])
        cur = best.get(mid)
        if cur is None or ingest > cur["ingest_at"]:
            best[mid] = {
                "municipality_id": mid,
                "region_id": int(cols["region_id"][i]),
                "province_id": int(cols["province_id"][i]),
                "ingest_at": ingest,
            }
    return sorted(best.values(), key=lambda r: r["municipality_id"])


def _read_municipality_gold(client, resolution: dict) -> pa.Table | None:
    prefix = gold_hive_prefix(
        resolution["region_id"],
        resolution["province_id"],
        resolution["municipality_id"],
        resolution["ingest_at"],
        GOLD_BAND_MUNICIPALITY,
    )
    key = f"{prefix}/part-000.parquet"
    raw = get_bytes(client, key)
    if raw is None:
        return None
    return pq.read_table(io.BytesIO(raw))


def _with_ingest_at(table: pa.Table, ingest_at: date) -> pa.Table:
    n = table.num_rows
    if n == 0:
        empty = {name: table.column(name) for name in table.column_names}
        empty["ingest_at"] = pa.array([], type=pa.date32())
        return pa.table(empty)
    ingest_col = pa.array([ingest_at] * n, type=pa.date32())
    if "ingest_at" in table.column_names:
        idx = table.schema.get_field_index("ingest_at")
        return table.set_column(idx, "ingest_at", ingest_col)
    return table.append_column("ingest_at", ingest_col)


def rollup(client) -> int:
    catalog = load_catalog_table(client)
    if catalog.num_rows == 0:
        print(f"Empty catalog s3://{bucket_name()}/{CATALOG_KEY}")
        return 0
    resolutions = _latest_asset_resolutions(catalog)
    print(f"Rolling up {len(resolutions)} municipality gold bands…")

    by_region: dict[int, list[pa.Table]] = defaultdict(list)
    missing = 0
    for res in resolutions:
        table = _read_municipality_gold(client, res)
        if table is None or table.num_rows == 0:
            missing += 1
            continue
        by_region[res["region_id"]].append(_with_ingest_at(table, res["ingest_at"]))

    written = 0
    for region_id, parts in sorted(by_region.items()):
        combined = pa.concat_tables(parts, promote_options="default")
        key = write_admin_region_municipality_bands(
            client, region_id=region_id, table=combined
        )
        print(
            f"  region_id={region_id}: s3://{bucket_name()}/{key} "
            f"rows={combined.num_rows} sources={len(parts)}"
        )
        written += 1
    print(f"Done. regions={written} missing_gold={missing}")
    return written


def main() -> int:
    client = s3_client()
    rollup(client)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
