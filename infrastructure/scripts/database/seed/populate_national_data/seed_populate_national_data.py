#!/usr/bin/env python3
"""Italy-wide synthetic green seed → MinIO lakehouse (parallel + checkpoint).

Reuses boost_one_municipality. See design:
  docs/design/2026-09-09-national-mock-lakehouse-seed-design.md

Usage:
  python seed_populate_national_data.py --dry-run
  python seed_populate_national_data.py --region "Valle d'Aosta" --limit 2 --trees 50 --workers 2
  python seed_populate_national_data.py --resume --workers 4 --trees 1200 --hedges 80 --areas 8
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

_SEED_DIR = Path(__file__).resolve().parents[1]
_BOOST_DIR = _SEED_DIR / "boost_municipality"
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

DEFAULT_AREAS = 8
DEFAULT_TREES = 1200
DEFAULT_HEDGES = 80
DEFAULT_WORKERS = 4

CHECKPOINT_PATH = _SEED_DIR / ".national_seed_checkpoint.jsonl"

_MM_YYYY = re.compile(r"^(\d{1,2})-(\d{4})$")
_print_lock = threading.Lock()


def parse_ingest_date(raw: str) -> date:
    text = raw.strip()
    m = _MM_YYYY.match(text)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return date(year, month, 1)
    return date.fromisoformat(text)


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


def muni_rng(base_seed: int, municipality_id: int) -> random.Random:
    return random.Random((base_seed * 1_000_003) ^ int(municipality_id))


def _log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def process_one(
    meta: dict[str, Any],
    *,
    n_areas: int,
    n_trees: int,
    n_hedges: int,
    ingest_date: date,
    base_seed: int,
    s3,
    checkpoint_path: Path,
) -> tuple[int, int, int]:
    mid = int(meta["municipality_id"])
    n_areas_out, n_assets = boost_one_municipality(
        meta,
        n_areas=n_areas,
        n_trees=n_trees,
        n_hedges=n_hedges,
        ingest_date=ingest_date,
        rng=muni_rng(base_seed, mid),
        s3=s3,
    )
    append_checkpoint(checkpoint_path, mid, ingest_date)
    return mid, n_areas_out, n_assets


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
        "--ingest-date",
        default=None,
        help="YYYY-MM-DD or MM-YYYY (default: today)",
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
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ingest_date = parse_ingest_date(
        args.ingest_date or os.environ.get("INGEST_DATE", date.today().isoformat())
    )
    workers = max(1, int(args.workers))

    if args.reset_checkpoint and args.checkpoint.is_file():
        args.checkpoint.unlink()
        print(f"Cleared checkpoint {args.checkpoint}")

    done = load_checkpoint(args.checkpoint) if args.resume else set()
    if args.resume:
        print(f"Resume: {len(done)} checkpoint entries loaded from {args.checkpoint}")

    os.environ.setdefault("DATABASE_URL", _database_url())

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

    pending = [
        m
        for m in municipalities
        if checkpoint_key(int(m["municipality_id"]), ingest_date) not in done
    ]

    print(
        f"National seed ingest_date={ingest_date.isoformat()} "
        f"regions={len(regions)} total_munis={len(municipalities)} "
        f"pending={len(pending)} skipped={len(municipalities) - len(pending)} "
        f"workers={workers} areas={args.areas} trees={args.trees} hedges={args.hedges}"
    )
    est_assets = len(pending) * (args.trees + args.hedges)
    print(f"Estimated new assets (pending × trees+hedges): ~{est_assets:,}")

    if args.dry_run:
        for i, meta in enumerate(pending[:20], 1):
            print(f"  [{i}] {meta['name']} id={meta['municipality_id']}")
        if len(pending) > 20:
            print(f"  … and {len(pending) - 20} more")
        print("Dry-run only; nothing written.")
        return 0

    if not pending:
        print("Nothing to do.")
        return 0

    s3 = s3_client()
    ok = 0
    failed = 0
    total_areas = 0
    total_assets = 0
    t0 = time.perf_counter()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(
                process_one,
                meta,
                n_areas=args.areas,
                n_trees=args.trees,
                n_hedges=args.hedges,
                ingest_date=ingest_date,
                base_seed=args.seed,
                s3=s3,
                checkpoint_path=args.checkpoint,
            ): meta
            for meta in pending
        }
        for i, fut in enumerate(as_completed(futures), 1):
            meta = futures[fut]
            try:
                mid, n_a, n_as = fut.result()
                ok += 1
                total_areas += n_a
                total_assets += n_as
                if i % 25 == 0 or i == len(futures):
                    elapsed = time.perf_counter() - t0
                    rate = ok / elapsed if elapsed > 0 else 0
                    _log(
                        f"  progress {i}/{len(futures)} ok={ok} fail={failed} "
                        f"assets={total_assets:,} ({rate:.2f} muni/s) "
                        f"last={meta['name']!r}"
                    )
            except Exception as exc:
                failed += 1
                _log(f"  FAIL {meta['name']!r} id={meta['municipality_id']}: {exc}")

    elapsed = time.perf_counter() - t0
    print(
        f"Done. ok={ok} failed={failed} areas={total_areas:,} assets={total_assets:,} "
        f"elapsed={elapsed / 60:.1f} min checkpoint={args.checkpoint}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
