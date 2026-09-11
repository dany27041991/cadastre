#!/usr/bin/env python3
"""Shared municipality snapshot seeding: real GeoJSON folders or synthetic mock.

Layout: ``DATA_DIR/municipality/<slug>/<YYYY-MM-DD>/{areas,trees,…}.geojson``

Design: docs/design/2026-09-10-multi-snapshot-national-seed-design.md
"""

from __future__ import annotations

import os
import random
import re
import sys
import warnings
from datetime import date
from pathlib import Path
from typing import Any, Iterable

_SEED_DIR = Path(__file__).resolve().parents[1]
_BOOST_DIR = _SEED_DIR / "boost_municipality"
_LECCE_DIR = _SEED_DIR / "populate_lecce_data"
_LAKEHOUSE_DIR = Path(__file__).resolve().parents[2] / "lakehouse"
for _p in (_BOOST_DIR, _LECCE_DIR, _LAKEHOUSE_DIR):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from boost_municipality_to_lakehouse import boost_one_municipality  # noqa: E402
from lakehouse_writer import s3_client  # noqa: E402

_ISO_DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MM_YYYY = re.compile(r"^(\d{1,2})-(\d{4})$")

DEFAULT_INGEST_DATES: tuple[date, ...] = (
    date(2021, 1, 1),
    date(2023, 1, 1),
    date(2024, 1, 1),
)


def municipality_slug(name: str) -> str:
    return name.strip().lower().replace(" ", "_")


def default_data_root() -> Path:
    if "DATA_DIR" in os.environ:
        return Path(os.environ["DATA_DIR"])
    # …/cadastre/infrastructure/scripts/database/seed/common → cadastre/infrastructure/data
    return Path(__file__).resolve().parents[4] / "data"


def parse_ingest_date(raw: str) -> date:
    """Accept YYYY-MM-DD or MM-YYYY (→ first day of month)."""
    text = raw.strip()
    m = _MM_YYYY.match(text)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return date(year, month, 1)
    return date.fromisoformat(text)


def parse_ingest_dates(
    raw: str | None = None,
    *,
    repeated: Iterable[str] | None = None,
    env_key: str = "INGEST_DATES",
    legacy_env_key: str = "INGEST_DATE",
    default: Iterable[date] | None = DEFAULT_INGEST_DATES,
) -> list[date]:
    """Parse CLI/env date list. Prefer comma-list, then repeatable flags, then defaults."""
    dates: list[date] = []
    if raw and raw.strip():
        for part in raw.split(","):
            part = part.strip()
            if part:
                dates.append(parse_ingest_date(part))
    if repeated:
        for part in repeated:
            if part and str(part).strip():
                dates.append(parse_ingest_date(str(part)))
    if not dates:
        env_multi = os.environ.get(env_key)
        if env_multi and env_multi.strip():
            for part in env_multi.split(","):
                part = part.strip()
                if part:
                    dates.append(parse_ingest_date(part))
    if not dates:
        legacy = os.environ.get(legacy_env_key)
        if legacy and legacy.strip():
            dates.append(parse_ingest_date(legacy))
    if not dates:
        dates = list(default or DEFAULT_INGEST_DATES)
    return sorted(set(dates))


def list_snapshot_dirs(data_root: Path, slug: str) -> list[date]:
    base = data_root / "municipality" / slug
    if not base.is_dir():
        return []
    out: list[date] = []
    for child in base.iterdir():
        if child.is_dir() and _ISO_DATE_DIR.match(child.name):
            try:
                out.append(date.fromisoformat(child.name))
            except ValueError:
                continue
    return sorted(set(out))


def resolve_dates(cli_dates: Iterable[date], data_root: Path, slug: str) -> list[date]:
    return sorted(set(cli_dates) | set(list_snapshot_dirs(data_root, slug)))


def snapshot_data_dir(data_root: Path, slug: str, ingest_date: date) -> Path | None:
    """Return snapshot path if it exists and contains areas.geojson; else None."""
    path = data_root / "municipality" / slug / ingest_date.isoformat()
    if path.is_dir() and (path / "areas.geojson").is_file():
        return path
    return None


def snapshot_source(
    data_root: Path, slug: str, ingest_date: date
) -> str:
    """``real`` or ``mock`` for dry-run / logging."""
    return "real" if snapshot_data_dir(data_root, slug, ingest_date) else "mock"


def muni_date_rng(base_seed: int, municipality_id: int, ingest_date: date) -> random.Random:
    """Deterministic RNG that differs across ingest dates for the same municipality."""
    day_key = ingest_date.toordinal()
    return random.Random((base_seed * 1_000_003) ^ int(municipality_id) ^ (day_key * 9176))


def seed_municipality_snapshot(
    meta: dict[str, Any],
    ingest_date: date,
    *,
    n_areas: int,
    n_trees: int,
    n_hedges: int,
    base_seed: int,
    data_root: Path | None = None,
    s3=None,
) -> tuple[str, int, int]:
    """Seed one (municipality, ingest_date). Returns (source, n_areas, n_assets)."""
    root = data_root or default_data_root()
    slug = municipality_slug(str(meta["name"]))
    real_dir = snapshot_data_dir(root, slug, ingest_date)
    client = s3 or s3_client()

    if real_dir is not None:
        from load_lecce_green_data import ingest_municipality_from_geojson  # noqa: WPS433

        n_a, n_as = ingest_municipality_from_geojson(
            real_dir,
            meta,
            ingest_date,
            s3=client,
        )
        return "real", n_a, n_as

    n_a, n_as = boost_one_municipality(
        meta,
        n_areas=n_areas,
        n_trees=n_trees,
        n_hedges=n_hedges,
        ingest_date=ingest_date,
        rng=muni_date_rng(base_seed, int(meta["municipality_id"]), ingest_date),
        s3=client,
    )
    return "mock", n_a, n_as


# Silence pyogrio duplicate-id noise when importing real loader transitively.
warnings.filterwarnings("ignore", message="Several features with id = 0 have been found")
