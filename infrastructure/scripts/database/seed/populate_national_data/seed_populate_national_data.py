#!/usr/bin/env python3
"""Italy-wide green seed → MinIO lakehouse (multi-snapshot, real GeoJSON or mock).

Reuses seed_municipality_snapshot. See design:
  docs/design/2026-09-10-multi-snapshot-national-seed-design.md

Usage:
  python seed_populate_national_data.py --dry-run
  python seed_populate_national_data.py --region "Valle d'Aosta" --limit 2 --trees 50 --workers 2
  python seed_populate_national_data.py --ingest-dates 2021-01-01,2023-01-01,2024-01-01 --resume --workers 4
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

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

DEFAULT_AREAS = 8
DEFAULT_TREES = 1200
DEFAULT_HEDGES = 80
DEFAULT_WORKERS = 4

CHECKPOINT_PATH = _SEED_DIR / ".national_seed_checkpoint.jsonl"

_print_lock = threading.Lock()


def list_all_regions(conn) -> list[tuple[int, str]]:
    rows = conn.execute(
        "SELECT id, name FROM public.regions ORDER BY id"
    ).fetchall()
    return [(int(r[0]), str(r[1])) for r in rows]


def checkpoint_key(municipality_id: int, ingest_date: date) -> str:
    return f"{municipality_id}:{ingest_date.isoformat()}"


def load_checkpoint(path: Path) -> set[str]:
    done: set[str] = set()
    if not path.is_file():
        return done
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("ok") and "municipality_id" in row and "ingest_date" in row:
                done.add(f"{int(row['municipality_id'])}:{row['ingest_date']}")
    return done


def append_checkpoint(path: Path, municipality_id: int, ingest_date: date) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "municipality_id": municipality_id,
        "ingest_date": ingest_date.isoformat(),
        "ok": True,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


def _log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def process_one(
    meta: dict[str, Any],
    *,
    ingest_date: date,
    n_areas: int,
    n_trees: int,
    n_hedges: int,
    base_seed: int,
    data_root: Path,
    s3,
    checkpoint_path: Path,
) -> tuple[int, str, int, int]:
    mid = int(meta["municipality_id"])
    source, n_areas_out, n_assets = seed_municipality_snapshot(
        meta,
        ingest_date,
        n_areas=n_areas,
        n_trees=n_trees,
        n_hedges=n_hedges,
        base_seed=base_seed,
        data_root=data_root,
        s3=s3,
    )
    append_checkpoint(checkpoint_path, mid, ingest_date)
    return mid, source, n_areas_out, n_assets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--region",
        default=None,
        help="Optional: only this region id or name (smoke / partial)",
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
        help="Deprecated alias: repeatable single date (merged into --ingest-dates)",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N municipalities (after filters)",
    )
    parser.add_argument("--resume", action="store_true", help="Skip checkpointed munis")
    parser.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Delete checkpoint file before run",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=CHECKPOINT_PATH,
        help=f"Checkpoint JSONL path (default {CHECKPOINT_PATH})",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="DATA_DIR root (default: infrastructure/data or $DATA_DIR)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cli_dates = parse_ingest_dates(
        args.ingest_dates,
        repeated=args.ingest_date_flags,
        default=DEFAULT_INGEST_DATES,
    )
    data_root = args.data_dir or default_data_root()
    workers = max(1, int(args.workers))

    if args.reset_checkpoint and args.checkpoint.is_file():
        args.checkpoint.unlink()
        print(f"Cleared checkpoint {args.checkpoint}")

    done = load_checkpoint(args.checkpoint) if args.resume else set()
    if args.resume:
        print(f"Resume: {len(done)} checkpoint entries loaded from {args.checkpoint}")

    os.environ.setdefault("DATABASE_URL", _database_url())
    os.environ.setdefault("DATA_DIR", str(data_root))

    with open_db() as conn:
        if args.region:
            region_id, region_name = fetch_region_id(conn, args.region)
            regions = [(region_id, region_name)]
        else:
            regions = list_all_regions(conn)

        municipalities: list[dict[str, Any]] = []
        for rid, rname in regions:
            munis = list_municipalities_in_region(conn, rid)
            print(f"  region {rname!r} id={rid}: {len(munis)} municipalities")
            municipalities.extend(munis)

    municipalities.sort(key=lambda m: int(m["municipality_id"]))
    if args.limit is not None:
        municipalities = municipalities[: max(0, args.limit)]

    jobs: list[tuple[dict[str, Any], date]] = []
    for meta in municipalities:
        slug = municipality_slug(str(meta["name"]))
        dates = resolve_dates(cli_dates, data_root, slug)
        for ingest_date in dates:
            if checkpoint_key(int(meta["municipality_id"]), ingest_date) in done:
                continue
            jobs.append((meta, ingest_date))

    print(
        f"National seed cli_dates=[{', '.join(d.isoformat() for d in cli_dates)}] "
        f"data_root={data_root} regions={len(regions)} "
        f"total_munis={len(municipalities)} pending_jobs={len(jobs)} "
        f"workers={workers} areas={args.areas} trees={args.trees} hedges={args.hedges}"
    )

    if args.dry_run:
        for i, (meta, ingest_date) in enumerate(jobs[:40], 1):
            slug = municipality_slug(str(meta["name"]))
            src = snapshot_source(data_root, slug, ingest_date)
            print(
                f"  [{i}] {meta['name']} id={meta['municipality_id']} "
                f"@ {ingest_date.isoformat()} ({src})"
            )
        if len(jobs) > 40:
            print(f"  … and {len(jobs) - 40} more")
        print("Dry-run only; nothing written.")
        return 0

    if not jobs:
        print("Nothing to do.")
        return 0

    s3 = s3_client()
    ok = 0
    failed = 0
    total_areas = 0
    total_assets = 0
    real_jobs = 0
    mock_jobs = 0
    t0 = time.perf_counter()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(
                process_one,
                meta,
                ingest_date=ingest_date,
                n_areas=args.areas,
                n_trees=args.trees,
                n_hedges=args.hedges,
                base_seed=args.seed,
                data_root=data_root,
                s3=s3,
                checkpoint_path=args.checkpoint,
            ): (meta, ingest_date)
            for meta, ingest_date in jobs
        }
        for i, fut in enumerate(as_completed(futures), 1):
            meta, ingest_date = futures[fut]
            try:
                _mid, source, n_a, n_as = fut.result()
                ok += 1
                total_areas += n_a
                total_assets += n_as
                if source == "real":
                    real_jobs += 1
                else:
                    mock_jobs += 1
                if i % 25 == 0 or i == len(futures):
                    elapsed = time.perf_counter() - t0
                    rate = ok / elapsed if elapsed > 0 else 0
                    _log(
                        f"  progress {i}/{len(futures)} ok={ok} fail={failed} "
                        f"real={real_jobs} mock={mock_jobs} assets={total_assets:,} "
                        f"({rate:.2f} job/s) last={meta['name']!r}@{ingest_date}"
                    )
            except Exception as exc:
                failed += 1
                _log(
                    f"  FAIL {meta['name']!r} id={meta['municipality_id']} "
                    f"@ {ingest_date.isoformat()}: {exc}"
                )

    elapsed = time.perf_counter() - t0
    print(
        f"Done. ok={ok} failed={failed} real={real_jobs} mock={mock_jobs} "
        f"areas={total_areas:,} assets={total_assets:,} "
        f"elapsed={elapsed / 60:.1f} min checkpoint={args.checkpoint}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
