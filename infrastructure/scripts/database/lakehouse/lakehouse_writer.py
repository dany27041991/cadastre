#!/usr/bin/env python3
"""Shared MinIO lakehouse writers for green seeders (silver + gold + catalog).

Seeders (Lecce GeoJSON, boost municipality, fixture) build silver PyArrow tables
and call ``ingest_municipality_tables``. PostGIS is not a green SoR — only admin
lookups may use it.

Usage (fixture smoke, host with MinIO on :9000):
  python lakehouse_writer.py --fixture
  python lakehouse_writer.py --fixture --ingest-date 2025-06-01

Env: LAKEHOUSE_S3_*, optional LAKEHOUSE_CATALOG_INVALIDATE_URL, DATABASE_URL (lookups only).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
from datetime import date, datetime, timezone
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

try:
    import boto3
    from botocore.client import Config
except ImportError as exc:  # pragma: no cover
    raise SystemExit("boto3 required: pip install -r requirements.txt") from exc

from gold_clusters import (
    admin_region_part_key,
    build_all_gold_bands,
    gold_hive_prefix,
)

CATALOG_KEY = "_catalog/municipality_ingests.parquet"


def _env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise SystemExit(f"Missing env {name}")
    return value


def s3_client():
    endpoint = os.environ.get("LAKEHOUSE_S3_ENDPOINT", "http://localhost:9000")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=_env("LAKEHOUSE_S3_ACCESS_KEY", "cadastre_lake"),
        aws_secret_access_key=_env("LAKEHOUSE_S3_SECRET_KEY", "cadastre_lake_dev_change_me"),
        region_name=os.environ.get("LAKEHOUSE_S3_REGION", "us-east-1"),
        config=Config(signature_version="s3v4"),
    )


def bucket_name() -> str:
    return os.environ.get("LAKEHOUSE_S3_BUCKET", "cadastre-lake")


def hive_prefix(
    dataset: str,
    region_id: int,
    province_id: int,
    municipality_id: int,
    ingest_date: date,
) -> str:
    folder = "green_assets" if dataset == "assets" else "green_areas"
    return (
        f"{folder}/region_id={region_id}/province_id={province_id}/"
        f"municipality_id={municipality_id}/ingest_date={ingest_date.isoformat()}"
    )


def put_bytes(client, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    client.put_object(Bucket=bucket_name(), Key=key, Body=data, ContentType=content_type)


def get_bytes(client, key: str) -> bytes | None:
    try:
        obj = client.get_object(Bucket=bucket_name(), Key=key)
        return obj["Body"].read()
    except client.exceptions.NoSuchKey:
        return None
    except Exception as exc:
        code = getattr(exc, "response", {}).get("Error", {}).get("Code")
        if code in {"NoSuchKey", "404"}:
            return None
        raise


def table_to_parquet_bytes(table: pa.Table) -> bytes:
    buf = io.BytesIO()
    pq.write_table(table, buf, compression="zstd")
    return buf.getvalue()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def catalog_schema() -> pa.Schema:
    return pa.schema(
        [
            ("municipality_id", pa.int32()),
            ("region_id", pa.int32()),
            ("province_id", pa.int32()),
            ("dataset", pa.string()),
            ("ingest_at", pa.date32()),
            ("object_prefix", pa.string()),
            ("row_count", pa.int64()),
            ("checksum", pa.string()),
            ("written_at", pa.timestamp("us", tz="UTC")),
        ]
    )


def load_catalog_table(client) -> pa.Table:
    raw = get_bytes(client, CATALOG_KEY)
    if not raw:
        return pa.Table.from_pylist([], schema=catalog_schema())
    return pq.read_table(io.BytesIO(raw))


def upsert_catalog(
    client,
    *,
    municipality_id: int,
    region_id: int,
    province_id: int,
    dataset: str,
    ingest_at: date,
    object_prefix: str,
    row_count: int,
    checksum: str,
) -> None:
    existing = load_catalog_table(client)
    rows: list[dict[str, Any]] = existing.to_pylist()
    rows = [
        r
        for r in rows
        if not (
            r["municipality_id"] == municipality_id
            and r["dataset"] == dataset
            and r["ingest_at"] == ingest_at
        )
    ]
    rows.append(
        {
            "municipality_id": municipality_id,
            "region_id": region_id,
            "province_id": province_id,
            "dataset": dataset,
            "ingest_at": ingest_at,
            "object_prefix": object_prefix,
            "row_count": row_count,
            "checksum": checksum,
            "written_at": datetime.now(timezone.utc),
        }
    )
    table = pa.Table.from_pylist(rows, schema=catalog_schema())
    put_bytes(client, CATALOG_KEY, table_to_parquet_bytes(table))


def write_dataset_part(
    client,
    *,
    dataset: str,
    region_id: int,
    province_id: int,
    municipality_id: int,
    ingest_date: date,
    table: pa.Table,
) -> tuple[str, int, str]:
    prefix = hive_prefix(dataset, region_id, province_id, municipality_id, ingest_date)
    key = f"{prefix}/part-000.parquet"
    staging_key = f"{prefix}/.staging/part-000.parquet"
    payload = table_to_parquet_bytes(table)
    checksum = sha256_hex(payload)
    put_bytes(client, staging_key, payload)
    put_bytes(client, key, payload)
    try:
        client.delete_object(Bucket=bucket_name(), Key=staging_key)
    except Exception:
        pass
    upsert_catalog(
        client,
        municipality_id=municipality_id,
        region_id=region_id,
        province_id=province_id,
        dataset=dataset,
        ingest_at=ingest_date,
        object_prefix=prefix,
        row_count=table.num_rows,
        checksum=checksum,
    )
    return key, table.num_rows, checksum


def write_gold_part(
    client,
    *,
    region_id: int,
    province_id: int,
    municipality_id: int,
    ingest_date: date,
    zoom_band: str,
    table: pa.Table,
) -> str:
    prefix = gold_hive_prefix(region_id, province_id, municipality_id, ingest_date, zoom_band)
    key = f"{prefix}/part-000.parquet"
    put_bytes(client, key, table_to_parquet_bytes(table))
    return key


def write_admin_region_municipality_bands(client, *, region_id: int, table: pa.Table) -> str:
    """Overwrite consolidated municipality-band gold for one region (admin rollup)."""
    key = admin_region_part_key(region_id)
    put_bytes(client, key, table_to_parquet_bytes(table))
    return key


def maybe_invalidate_api_catalog_cache() -> None:
    """Optional POST after ingest so API pods drop TTL cache immediately."""
    url = os.environ.get("LAKEHOUSE_CATALOG_INVALIDATE_URL", "").strip()
    if not url:
        return
    try:
        import urllib.request

        req = urllib.request.Request(url, method="POST", data=b"")
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  catalog cache invalidate: HTTP {resp.status} → {url}")
    except Exception as exc:
        print(f"  WARNING: catalog invalidate failed ({url}): {exc}")


def ingest_municipality_tables(
    client,
    *,
    meta: dict[str, Any],
    assets: pa.Table,
    areas: pa.Table,
    ingest_date: date,
    write_gold: bool = True,
) -> None:
    """Write silver assets/areas + catalog (+ gold clusters from assets)."""
    print(
        f"Lakehouse ingest {meta.get('name', meta['municipality_id'])} "
        f"id={meta['municipality_id']} ingest_date={ingest_date} "
        f"assets={assets.num_rows} areas={areas.num_rows}"
    )
    for dataset, table in (("assets", assets), ("areas", areas)):
        key, n, checksum = write_dataset_part(
            client,
            dataset=dataset,
            region_id=meta["region_id"],
            province_id=meta["province_id"],
            municipality_id=meta["municipality_id"],
            ingest_date=ingest_date,
            table=table,
        )
        print(f"  {dataset}: s3://{bucket_name()}/{key} rows={n} sha256={checksum[:12]}…")

    if write_gold:
        gold_bands = build_all_gold_bands(
            assets,
            region_id=meta["region_id"],
            province_id=meta["province_id"],
            municipality_id=meta["municipality_id"],
        )
        for band, gtable in gold_bands.items():
            gkey = write_gold_part(
                client,
                region_id=meta["region_id"],
                province_id=meta["province_id"],
                municipality_id=meta["municipality_id"],
                ingest_date=ingest_date,
                zoom_band=band,
                table=gtable,
            )
            print(f"  gold[{band}]: s3://{bucket_name()}/{gkey} rows={gtable.num_rows}")

    print(f"Catalog updated: s3://{bucket_name()}/{CATALOG_KEY}")
    maybe_invalidate_api_catalog_cache()


def fixture_tables(ingest_date: date) -> tuple[dict[str, Any], pa.Table, pa.Table]:
    """Tiny Lecce-like mosaic for smoke without PostGIS / GeoJSON."""
    meta = {
        "municipality_id": 999001,
        "province_id": 99901,
        "region_id": 999,
        "name": "FixtureComune",
    }
    assets = pa.table(
        {
            "id": pa.array([1, 2], type=pa.int64()),
            "green_area_id": pa.array([10, 10], type=pa.int64()),
            "region_id": pa.array([meta["region_id"], meta["region_id"]], type=pa.int32()),
            "province_id": pa.array([meta["province_id"], meta["province_id"]], type=pa.int32()),
            "municipality_id": pa.array(
                [meta["municipality_id"], meta["municipality_id"]], type=pa.int32()
            ),
            "ingest_date": pa.array([ingest_date, ingest_date], type=pa.date32()),
            "asset_type": pa.array(["tree", "tree"], type=pa.string()),
            "geometry_type": pa.array(["P", "P"], type=pa.string()),
            "lon": pa.array([18.172, 18.173], type=pa.float64()),
            "lat": pa.array([40.352, 40.353], type=pa.float64()),
            "geom_wkb": pa.array([None, None], type=pa.binary()),
            "species": pa.array(["Quercus ilex", "Pinus pinea"], type=pa.string()),
            "family": pa.array(["Fagaceae", "Pinaceae"], type=pa.string()),
            "genus": pa.array(["Quercus", "Pinus"], type=pa.string()),
            "variety": pa.array([None, None], type=pa.string()),
            "health_status": pa.array(["GOOD", "FAIR"], type=pa.string()),
            "asset_status": pa.array(["ACTIVE", "ACTIVE"], type=pa.string()),
            "survey_date": pa.array([None, None], type=pa.timestamp("us", tz="UTC")),
        }
    )
    areas = pa.table(
        {
            "id": pa.array([10], type=pa.int64()),
            "region_id": pa.array([meta["region_id"]], type=pa.int32()),
            "province_id": pa.array([meta["province_id"]], type=pa.int32()),
            "municipality_id": pa.array([meta["municipality_id"]], type=pa.int32()),
            "ingest_date": pa.array([ingest_date], type=pa.date32()),
            "parent_id": pa.array([None], type=pa.int64()),
            "level": pa.array([1], type=pa.int32()),
            "name": pa.array(["Parco Fixture"], type=pa.string()),
            "lon": pa.array([18.1725], type=pa.float64()),
            "lat": pa.array([40.3525], type=pa.float64()),
            "geom_wkb": pa.array([None], type=pa.binary()),
            "area_classification": pa.array(["PARK"], type=pa.string()),
            "administrative_status": pa.array(["ACTIVE"], type=pa.string()),
            "survey_date": pa.array([None], type=pa.timestamp("us", tz="UTC")),
        }
    )
    return meta, assets, areas


def open_db():
    import psycopg

    url = os.environ.get("DATABASE_DIRECT_URL") or os.environ.get("DATABASE_URL")
    if not url:
        user = os.environ.get("POSTGRES_USER", "cadastre")
        password = os.environ.get("POSTGRES_PASSWORD", "")
        host = os.environ.get("POSTGRES_HOST", "localhost")
        port = os.environ.get("POSTGRES_PORT", "5432")
        db = os.environ.get("POSTGRES_DB", "arboreal_green_cadastre")
        url = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    return psycopg.connect(url)


def fetch_municipality_meta(conn, municipality_name: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT m.id, m.name, m.province_id, p.region_id
        FROM public.municipalities m
        JOIN public.provinces p ON p.id = m.province_id
        WHERE m.name = %s
        """,
        (municipality_name,),
    ).fetchone()
    if not row:
        raise SystemExit(f"Municipality not found: {municipality_name!r}")
    return {
        "municipality_id": int(row[0]),
        "name": row[1],
        "province_id": int(row[2]),
        "region_id": int(row[3]),
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--fixture",
        action="store_true",
        help="Write synthetic comune data (no PostGIS) for smoke tests",
    )
    p.add_argument(
        "--ingest-date",
        default=date.today().isoformat(),
        help="Batch date YYYY-MM-DD (default: today)",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if not args.fixture:
        raise SystemExit("Use --fixture, or call ingest_municipality_tables from a seeder")
    ingest_date = date.fromisoformat(args.ingest_date)
    meta, assets, areas = fixture_tables(ingest_date)
    ingest_municipality_tables(
        s3_client(),
        meta=meta,
        assets=assets,
        areas=areas,
        ingest_date=ingest_date,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
