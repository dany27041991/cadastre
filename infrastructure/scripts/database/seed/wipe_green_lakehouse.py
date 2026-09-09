#!/usr/bin/env python3
"""Delete green lakehouse object prefixes on MinIO (silver/gold/catalog).

Does not touch PostGIS. Safe prefixes only (see GREEN_PREFIXES).

Usage:
  LAKEHOUSE_S3_ENDPOINT=http://localhost:9000 python wipe_green_lakehouse.py --dry-run
  LAKEHOUSE_S3_ENDPOINT=http://localhost:9000 python wipe_green_lakehouse.py --yes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lakehouse"))

from lakehouse_writer import bucket_name, s3_client  # noqa: E402

GREEN_PREFIXES = (
    "green_assets/",
    "green_areas/",
    "green_assets_clusters/",
    "green_assets_admin_clusters/",
    "_catalog/",
)


def list_keys(client, prefix: str) -> list[str]:
    keys: list[str] = []
    token = None
    while True:
        kwargs: dict = {"Bucket": bucket_name(), "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = client.list_objects_v2(**kwargs)
        for obj in resp.get("Contents") or []:
            keys.append(obj["Key"])
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return keys


def delete_keys(client, keys: list[str]) -> int:
    deleted = 0
    # S3 delete_objects max 1000 keys per call
    for i in range(0, len(keys), 1000):
        chunk = keys[i : i + 1000]
        client.delete_objects(
            Bucket=bucket_name(),
            Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True},
        )
        deleted += len(chunk)
    return deleted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List object counts per prefix; do not delete",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Required to actually delete (safety)",
    )
    args = parser.parse_args()

    client = s3_client()
    print(f"Bucket s3://{bucket_name()}/")
    total = 0
    for prefix in GREEN_PREFIXES:
        keys = list_keys(client, prefix)
        print(f"  {prefix}: {len(keys)} objects")
        total += len(keys)
        if args.dry_run or not keys:
            continue
        if not args.yes:
            print("Refusing to delete without --yes (or use --dry-run).", file=sys.stderr)
            return 2
        n = delete_keys(client, keys)
        print(f"    deleted {n}")
    print(f"Total objects scanned: {total}")
    if args.dry_run:
        print("Dry-run only; nothing deleted.")
    elif not args.yes and total > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
