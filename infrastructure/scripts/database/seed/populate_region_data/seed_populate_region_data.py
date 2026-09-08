#!/usr/bin/env python3
"""Region-wide synthetic green seed → MinIO lakehouse.

Loops every municipality in a region and reuses the boost municipality MVP
(grid areas + random trees/hedges → silver + gold + catalog). Not a Voronoi port.

Usage:
  python seed_populate_region_data.py --region "Valle d'Aosta"
  python seed_populate_region_data.py --region 2 --limit 3 --areas 10 --trees 200 --hedges 20
  python seed_populate_region_data.py --region Lazio --ingest-date 01-2024 --ingest-date 01-2025 --ingest-date 01-2026
  python seed_populate_region_data.py --region Puglia --dry-run
"""

from __future__ import annotations

import argparse
import os
import random
import re
import sys
from datetime import date
from pathlib import Path

_BOOST_DIR = Path(__file__).resolve().parents[1] / "boost_municipality"
_LAKEHOUSE_DIR = Path(__file__).resolve().parents[2] / "lakehouse"
for _p in (_BOOST_DIR, _LAKEHOUSE_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from boost_municipality_to_lakehouse import (  # noqa: E402
    _database_url,
    boost_one_municipality,
    fetch_region_id,
    list_municipalities_in_region,
)
from lakehouse_writer import open_db, s3_client  # noqa: E402

# Lean defaults for regional mosaic (full boost defaults are too heavy × N comuni).
DEFAULT_AREAS = 10
DEFAULT_TREES = 500
DEFAULT_HEDGES = 50

_MM_YYYY = re.compile(r"^(\d{1,2})-(\d{4})$")


def parse_ingest_date(raw: str) -> date:
    """Accept YYYY-MM-DD or MM-YYYY (→ first day of month)."""
    text = raw.strip()
    m = _MM_YYYY.match(text)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return date(year, month, 1)
    return date.fromisoformat(text)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--region",
        required=True,
        help="Region id (e.g. 12) or name (e.g. Lazio)",
    )
    parser.add_argument("--areas", type=int, default=DEFAULT_AREAS)
    parser.add_argument("--trees", type=int, default=DEFAULT_TREES)
    parser.add_argument("--hedges", type=int, default=DEFAULT_HEDGES)
    parser.add_argument(
        "--ingest-date",
        action="append",
        dest="ingest_dates",
        metavar="DATE",
        help="Batch date YYYY-MM-DD or MM-YYYY (repeatable). Default: INGEST_DATE or today.",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N municipalities (smoke / partial runs)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List municipalities that would be seeded; do not write MinIO",
    )
    args = parser.parse_args()

    raw_dates = args.ingest_dates or [os.environ.get("INGEST_DATE", date.today().isoformat())]
    ingest_dates = [parse_ingest_date(d) for d in raw_dates]
    # Stable order, unique
    ingest_dates = sorted(set(ingest_dates))

    os.environ.setdefault("DATABASE_URL", _database_url())

    with open_db() as conn:
        region_id, region_name = fetch_region_id(conn, args.region)
        municipalities = list_municipalities_in_region(conn, region_id)

    if args.limit is not None:
        municipalities = municipalities[: max(0, args.limit)]

    dates_label = ", ".join(d.isoformat() for d in ingest_dates)
    print(
        f"Region {region_name!r} id={region_id}: {len(municipalities)} municipalities × "
        f"{len(ingest_dates)} ingest(s) [{dates_label}] "
        f"(areas={args.areas} trees={args.trees} hedges={args.hedges})"
    )
    if args.dry_run:
        for i, meta in enumerate(municipalities, 1):
            print(f"  [{i}] {meta['name']} id={meta['municipality_id']}")
        print("Dry-run only; nothing written.")
        return 0

    if not municipalities:
        print("No municipalities with geometry in this region.", file=sys.stderr)
        return 1

    s3 = s3_client()
    ok = 0
    failed = 0
    total_areas = 0
    total_assets = 0
    total_jobs = len(municipalities) * len(ingest_dates)
    job = 0
    for ingest_date in ingest_dates:
        print(f"=== ingest_date={ingest_date.isoformat()} ===", flush=True)
        for i, meta in enumerate(municipalities, 1):
            job += 1
            # Deterministic per (municipality, year) so batches differ across years.
            rng = random.Random(
                args.seed
                + int(meta["municipality_id"]) * 1_000
                + ingest_date.year * 12
                + ingest_date.month
            )
            print(
                f"[{job}/{total_jobs}] {meta['name']} id={meta['municipality_id']} "
                f"@ {ingest_date.isoformat()} …",
                flush=True,
            )
            try:
                n_areas, n_assets = boost_one_municipality(
                    meta,
                    n_areas=args.areas,
                    n_trees=args.trees,
                    n_hedges=args.hedges,
                    ingest_date=ingest_date,
                    rng=rng,
                    s3=s3,
                )
                ok += 1
                total_areas += n_areas
                total_assets += n_assets
                print(f"  → areas={n_areas} assets={n_assets}")
            except Exception as exc:
                failed += 1
                print(f"  → FAILED: {exc}", file=sys.stderr)

    print(
        f"Done. ok={ok} failed={failed} "
        f"total_areas={total_areas} total_assets={total_assets}"
    )
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
