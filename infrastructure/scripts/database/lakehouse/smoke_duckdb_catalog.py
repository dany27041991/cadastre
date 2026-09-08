#!/usr/bin/env python3
"""Smoke: resolve max(ingest_at) per municipality from catalog + read silver Parquet via DuckDB httpfs."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date


def main() -> int:
    import duckdb

    p = argparse.ArgumentParser()
    p.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    p.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    p.add_argument(
        "--municipality-id",
        type=int,
        action="append",
        dest="municipality_ids",
        help="Repeatable; default = all in catalog",
    )
    args = p.parse_args()
    date_from = date.fromisoformat(args.date_from)
    date_to = date.fromisoformat(args.date_to)

    endpoint = os.environ.get("LAKEHOUSE_S3_ENDPOINT", "http://localhost:9000")
    key = os.environ.get("LAKEHOUSE_S3_ACCESS_KEY", "cadastre_lake")
    secret = os.environ.get("LAKEHOUSE_S3_SECRET_KEY", "cadastre_lake_dev_change_me")
    bucket = os.environ.get("LAKEHOUSE_S3_BUCKET", "cadastre-lake")
    region = os.environ.get("LAKEHOUSE_S3_REGION", "us-east-1")

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(
        f"""
        SET s3_endpoint='{endpoint.replace("https://", "").replace("http://", "")}';
        SET s3_access_key_id='{key}';
        SET s3_secret_access_key='{secret}';
        SET s3_region='{region}';
        SET s3_url_style='path';
        SET s3_use_ssl={'true' if endpoint.startswith('https') else 'false'};
        """
    )

    catalog_uri = f"s3://{bucket}/_catalog/municipality_ingests.parquet"
    con.execute(f"CREATE OR REPLACE VIEW municipality_ingests AS SELECT * FROM read_parquet('{catalog_uri}')")

    muni_filter = ""
    if args.municipality_ids:
        ids = ",".join(str(i) for i in args.municipality_ids)
        muni_filter = f"AND municipality_id IN ({ids})"

    resolved = con.execute(
        f"""
        SELECT municipality_id, dataset, max(ingest_at) AS ingest_at, any_value(object_prefix) AS object_prefix
        FROM (
          SELECT municipality_id, dataset, ingest_at, object_prefix,
                 rank() OVER (
                   PARTITION BY municipality_id, dataset
                   ORDER BY ingest_at DESC
                 ) AS rk
          FROM municipality_ingests
          WHERE ingest_at >= DATE '{date_from.isoformat()}'
            AND ingest_at <= DATE '{date_to.isoformat()}'
            {muni_filter}
        )
        WHERE rk = 1
        GROUP BY municipality_id, dataset
        ORDER BY municipality_id, dataset
        """
    ).fetchall()

    print(f"Resolved {len(resolved)} (municipality, dataset) pairs in [{date_from}, {date_to}]:")
    for municipality_id, dataset, ingest_at, object_prefix in resolved:
        print(f"  M={municipality_id} {dataset} ingest_at={ingest_at} prefix={object_prefix}")
        glob_uri = f"s3://{bucket}/{object_prefix}/part-*.parquet"
        n = con.execute(f"SELECT count(*) FROM read_parquet('{glob_uri}')").fetchone()[0]
        print(f"    rows={n}")

    if not resolved:
        print("WARN: no catalog rows in range (empty mosaic).")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
