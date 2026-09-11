#!/usr/bin/env python3
"""Region-wide green seed → MinIO lakehouse (multi-snapshot, real GeoJSON or mock).

Usage:
  python seed_populate_region_data.py --region "Valle d'Aosta"
  python seed_populate_region_data.py --region 2 --limit 3 --areas 10 --trees 200 --hedges 20
  python seed_populate_region_data.py --region Lazio --ingest-dates 2021-01-01,2023-01-01,2024-01-01
  python seed_populate_region_data.py --region Puglia --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_SEED_DIR = Path(__file__).resolve().parents[1]
_COMMON_DIR = _SEED_DIR / "common"
_BOOST_DIR = _SEED_DIR / "boost_municipality"
_LAKEHOUSE_DIR = Path(__file__).resolve().parents[2] / "lakehouse"
for _p in (_COMMON_DIR, _BOOST_DIR, _LAKEHOUSE_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from boost_municipality_to_lakehouse import (  # noqa: E402
    _database_url,
    fetch_region_id,
    list_municipalities_in_region,
)
from lakehouse_writer import open_db, s3_client  # noqa: E402
from seed_municipality_snapshot import (  # noqa: E402
    DEFAULT_INGEST_DATES,
    default_data_root,
    municipality_slug,
    parse_ingest_dates,
    resolve_dates,
    seed_municipality_snapshot,
    snapshot_source,
)

DEFAULT_AREAS = 10
DEFAULT_TREES = 500
DEFAULT_HEDGES = 50


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
        "--ingest-dates",
        default=None,
        help=(
            "Comma-separated YYYY-MM-DD (or MM-YYYY). "
            f"Default: {','.join(d.isoformat() for d in DEFAULT_INGEST_DATES)}"
        ),
    )
    parser.add_argument(
        "--ingest-date",
        action="append",
        dest="ingest_date_flags",
        metavar="DATE",
        help="Repeatable single date (merged into --ingest-dates)",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N municipalities (smoke / partial runs)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="DATA_DIR root (default: infrastructure/data or $DATA_DIR)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List municipalities × dates that would be seeded; do not write MinIO",
    )
    args = parser.parse_args()

    cli_dates = parse_ingest_dates(
        args.ingest_dates,
        repeated=args.ingest_date_flags,
        default=DEFAULT_INGEST_DATES,
    )
    data_root = args.data_dir or default_data_root()

    os.environ.setdefault("DATABASE_URL", _database_url())
    os.environ.setdefault("DATA_DIR", str(data_root))

    with open_db() as conn:
        region_id, region_name = fetch_region_id(conn, args.region)
        municipalities = list_municipalities_in_region(conn, region_id)

    if args.limit is not None:
        municipalities = municipalities[: max(0, args.limit)]

    jobs: list[tuple[dict, object]] = []
    for meta in municipalities:
        slug = municipality_slug(str(meta["name"]))
        for ingest_date in resolve_dates(cli_dates, data_root, slug):
            jobs.append((meta, ingest_date))

    dates_label = ", ".join(d.isoformat() for d in cli_dates)
    print(
        f"Region {region_name!r} id={region_id}: {len(municipalities)} municipalities, "
        f"{len(jobs)} jobs, cli_dates=[{dates_label}] "
        f"(areas={args.areas} trees={args.trees} hedges={args.hedges})"
    )
    if args.dry_run:
        for i, (meta, ingest_date) in enumerate(jobs, 1):
            slug = municipality_slug(str(meta["name"]))
            src = snapshot_source(data_root, slug, ingest_date)
            print(
                f"  [{i}] {meta['name']} id={meta['municipality_id']} "
                f"@ {ingest_date.isoformat()} ({src})"
            )
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
    for job_i, (meta, ingest_date) in enumerate(jobs, 1):
        print(
            f"[{job_i}/{len(jobs)}] {meta['name']} id={meta['municipality_id']} "
            f"@ {ingest_date.isoformat()} …",
            flush=True,
        )
        try:
            source, n_areas, n_assets = seed_municipality_snapshot(
                meta,
                ingest_date,
                n_areas=args.areas,
                n_trees=args.trees,
                n_hedges=args.hedges,
                base_seed=args.seed,
                data_root=data_root,
                s3=s3,
            )
            ok += 1
            total_areas += n_areas
            total_assets += n_assets
            print(f"  → {source} areas={n_areas} assets={n_assets}")
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
