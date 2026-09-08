#!/usr/bin/env python3
"""Boost a single municipality with synthetic green areas/assets → MinIO lakehouse.

Replaces the former PostGIS SQL boost (municipality_clean.sql / municipality_populate.sql).
Reads municipality boundary from PostGIS (read-only); writes silver + gold + catalog to MinIO.

MVP geometry model (not full Voronoi):
  - level-1 management units on a grid clipped to the municipality polygon
  - trees as random points inside the polygon
  - hedges as east-west line segments across the bbox (clipped)

Usage:
  python boost_municipality_to_lakehouse.py --municipality Roma
  python boost_municipality_to_lakehouse.py --municipality "L'Aquila" --areas 80 --trees 20000 --hedges 2000
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow as pa

try:
    from shapely import make_valid, to_wkb, wkb as shapely_wkb
    from shapely.geometry import LineString, Point, box
    from shapely.ops import unary_union
except ImportError as e:
    print(f"Error: missing dependency - {e}", file=sys.stderr)
    sys.exit(1)

_LAKEHOUSE_DIR = Path(__file__).resolve().parents[2] / "lakehouse"
if str(_LAKEHOUSE_DIR) not in sys.path:
    sys.path.insert(0, str(_LAKEHOUSE_DIR))

from lakehouse_writer import ingest_municipality_tables, open_db, s3_client  # noqa: E402

# Defaults sized for a usable local mosaic (not the old ~320k-tree SQL boost).
DEFAULT_AREAS = 40
DEFAULT_TREES = 5000
DEFAULT_HEDGES = 500

_SPECIES = (
    ("Quercus ilex", "Fagaceae", "Quercus"),
    ("Pinus pinea", "Pinaceae", "Pinus"),
    ("Platanus x acerifolia", "Platanaceae", "Platanus"),
    ("Tilia cordata", "Malvaceae", "Tilia"),
    ("Acer pseudoplatanus", "Sapindaceae", "Acer"),
)


def _database_url() -> str:
    url = os.environ.get("DATABASE_DIRECT_URL") or os.environ.get("DATABASE_URL")
    if url:
        return url
    user = os.environ.get("POSTGRES_USER", "cadastre")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "arboreal_green_cadastre")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


def _meta_from_row(row) -> dict[str, Any]:
    geom = shapely_wkb.loads(bytes(row[4]))
    geom = make_valid(geom)
    return {
        "municipality_id": int(row[0]),
        "name": row[1],
        "province_id": int(row[2]),
        "region_id": int(row[3]),
        "geometry": geom,
    }


def fetch_municipality(conn, name: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT m.id, m.name, m.province_id, p.region_id, ST_AsBinary(m.geometry)
        FROM public.municipalities m
        JOIN public.provinces p ON p.id = m.province_id
        WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(%s))
          AND m.geometry IS NOT NULL
        LIMIT 1
        """,
        (name,),
    ).fetchone()
    if not row:
        raise SystemExit(f"Municipality not found (or no geometry): {name!r}")
    return _meta_from_row(row)


def fetch_region_id(conn, region: str) -> tuple[int, str]:
    """Resolve region by numeric id or case-insensitive name → (id, name)."""
    region = region.strip()
    if region.isdigit():
        row = conn.execute(
            "SELECT id, name FROM public.regions WHERE id = %s LIMIT 1",
            (int(region),),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT id, name FROM public.regions
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            LIMIT 1
            """,
            (region,),
        ).fetchone()
    if not row:
        raise SystemExit(f"Region not found: {region!r}")
    return int(row[0]), str(row[1])


def list_municipalities_in_region(conn, region_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT m.id, m.name, m.province_id, p.region_id, ST_AsBinary(m.geometry)
        FROM public.municipalities m
        JOIN public.provinces p ON p.id = m.province_id
        WHERE p.region_id = %s
          AND m.geometry IS NOT NULL
        ORDER BY m.id
        """,
        (region_id,),
    ).fetchall()
    return [_meta_from_row(r) for r in rows]


def _random_point_in_polygon(poly, rng: random.Random, max_tries: int = 80) -> Point | None:
    minx, miny, maxx, maxy = poly.bounds
    for _ in range(max_tries):
        pt = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
        if poly.contains(pt) or poly.intersects(pt):
            return pt
    try:
        return poly.representative_point()
    except Exception:
        return None


def build_areas_table(
    meta: dict[str, Any],
    n_areas: int,
    ingest_date: date,
    rng: random.Random,
) -> pa.Table:
    poly = meta["geometry"]
    minx, miny, maxx, maxy = poly.bounds
    cols = max(2, int(math.ceil(math.sqrt(n_areas))))
    rows = max(2, int(math.ceil(n_areas / cols)))
    dx = (maxx - minx) / cols
    dy = (maxy - miny) / rows

    ids: list[int] = []
    names: list[str] = []
    lons: list[float | None] = []
    lats: list[float | None] = []
    wkbs: list[bytes | None] = []
    classifications: list[str] = []

    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= n_areas:
                break
            cell = box(minx + c * dx, miny + r * dy, minx + (c + 1) * dx, miny + (r + 1) * dy)
            inter = cell.intersection(poly)
            if inter.is_empty:
                continue
            inter = make_valid(inter)
            if inter.geom_type == "GeometryCollection":
                polys = [g for g in inter.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
                if not polys:
                    continue
                inter = unary_union(polys)
            if inter.is_empty:
                continue
            idx += 1
            centroid = inter.centroid
            ids.append(idx)
            names.append(f"Area boost {idx}")
            lons.append(float(centroid.x))
            lats.append(float(centroid.y))
            wkbs.append(to_wkb(inter, hex=False))
            classifications.append(
                rng.choice(["URBAN_PARKS", "EQUIPPED_GREEN", "URBAN_FURNISHING", "OTHER"])
            )
        if idx >= n_areas:
            break

    n = len(ids)
    mid = meta["municipality_id"]
    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "region_id": pa.array([meta["region_id"]] * n, type=pa.int32()),
            "province_id": pa.array([meta["province_id"]] * n, type=pa.int32()),
            "municipality_id": pa.array([mid] * n, type=pa.int32()),
            "ingest_date": pa.array([ingest_date] * n, type=pa.date32()),
            "parent_id": pa.array([None] * n, type=pa.int64()),
            "level": pa.array([1] * n, type=pa.int32()),
            "name": pa.array(names, type=pa.string()),
            "lon": pa.array(lons, type=pa.float64()),
            "lat": pa.array(lats, type=pa.float64()),
            "geom_wkb": pa.array(wkbs, type=pa.binary()),
            "area_classification": pa.array(classifications, type=pa.string()),
            "administrative_status": pa.array(["ACTIVE"] * n, type=pa.string()),
            "survey_date": pa.array([None] * n, type=pa.timestamp("us", tz="UTC")),
        }
    )


def build_assets_table(
    meta: dict[str, Any],
    area_ids: list[int],
    n_trees: int,
    n_hedges: int,
    ingest_date: date,
    rng: random.Random,
) -> pa.Table:
    poly = meta["geometry"]
    minx, miny, maxx, maxy = poly.bounds
    mid = meta["municipality_id"]

    ids: list[int] = []
    green_area_ids: list[int | None] = []
    asset_types: list[str] = []
    geometry_types: list[str] = []
    lons: list[float | None] = []
    lats: list[float | None] = []
    wkbs: list[bytes | None] = []
    species_l: list[str | None] = []
    family_l: list[str | None] = []
    genus_l: list[str | None] = []

    next_id = 1
    for _ in range(n_trees):
        pt = _random_point_in_polygon(poly, rng)
        if pt is None:
            continue
        sp, fam, gen = rng.choice(_SPECIES)
        ga = rng.choice(area_ids) if area_ids else None
        ids.append(next_id)
        next_id += 1
        green_area_ids.append(ga)
        asset_types.append("tree")
        geometry_types.append("P")
        lons.append(float(pt.x))
        lats.append(float(pt.y))
        wkbs.append(to_wkb(pt, hex=False))
        species_l.append(sp)
        family_l.append(fam)
        genus_l.append(gen)

    for i in range(n_hedges):
        y = miny + ((i + 1) / (n_hedges + 1)) * (maxy - miny)
        line = LineString([(minx, y), (maxx, y)])
        clipped = line.intersection(poly)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "MultiLineString":
            clipped = max(clipped.geoms, key=lambda g: g.length)
        if clipped.geom_type != "LineString" or clipped.length <= 0:
            continue
        centroid = clipped.centroid
        ga = rng.choice(area_ids) if area_ids else None
        ids.append(next_id)
        next_id += 1
        green_area_ids.append(ga)
        asset_types.append("hedge")
        geometry_types.append("L")
        lons.append(float(centroid.x))
        lats.append(float(centroid.y))
        wkbs.append(to_wkb(clipped, hex=False))
        species_l.append("Ligustrum vulgare")
        family_l.append("Oleaceae")
        genus_l.append("Ligustrum")

    n = len(ids)
    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "green_area_id": pa.array(green_area_ids, type=pa.int64()),
            "region_id": pa.array([meta["region_id"]] * n, type=pa.int32()),
            "province_id": pa.array([meta["province_id"]] * n, type=pa.int32()),
            "municipality_id": pa.array([mid] * n, type=pa.int32()),
            "ingest_date": pa.array([ingest_date] * n, type=pa.date32()),
            "asset_type": pa.array(asset_types, type=pa.string()),
            "geometry_type": pa.array(geometry_types, type=pa.string()),
            "lon": pa.array(lons, type=pa.float64()),
            "lat": pa.array(lats, type=pa.float64()),
            "geom_wkb": pa.array(wkbs, type=pa.binary()),
            "species": pa.array(species_l, type=pa.string()),
            "family": pa.array(family_l, type=pa.string()),
            "genus": pa.array(genus_l, type=pa.string()),
            "variety": pa.array([None] * n, type=pa.string()),
            "health_status": pa.array([None] * n, type=pa.string()),
            "asset_status": pa.array(["ACTIVE"] * n, type=pa.string()),
            "survey_date": pa.array([None] * n, type=pa.timestamp("us", tz="UTC")),
        }
    )


def boost_one_municipality(
    meta: dict[str, Any],
    *,
    n_areas: int,
    n_trees: int,
    n_hedges: int,
    ingest_date: date,
    rng: random.Random,
    s3=None,
) -> tuple[int, int]:
    """Generate + ingest synthetic areas/assets for one municipality. Returns (n_areas, n_assets)."""
    areas = build_areas_table(meta, n_areas, ingest_date, rng)
    area_ids = areas.column("id").to_pylist()
    if not area_ids:
        raise RuntimeError(f"no areas generated inside municipality geometry: {meta['name']!r}")
    assets = build_assets_table(meta, area_ids, n_trees, n_hedges, ingest_date, rng)
    ingest_municipality_tables(
        s3 or s3_client(),
        meta=meta,
        assets=assets,
        areas=areas,
        ingest_date=ingest_date,
    )
    return len(area_ids), assets.num_rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--municipality", required=True, help="Exact name in public.municipalities")
    parser.add_argument("--areas", type=int, default=DEFAULT_AREAS, help=f"Green areas (default {DEFAULT_AREAS})")
    parser.add_argument("--trees", type=int, default=DEFAULT_TREES, help=f"Tree points (default {DEFAULT_TREES})")
    parser.add_argument("--hedges", type=int, default=DEFAULT_HEDGES, help=f"Hedge lines (default {DEFAULT_HEDGES})")
    parser.add_argument("--ingest-date", default=date.today().isoformat())
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    args = parser.parse_args()

    ingest_date = date.fromisoformat(args.ingest_date)
    rng = random.Random(args.seed)

    os.environ.setdefault("DATABASE_URL", _database_url())
    with open_db() as conn:
        meta = fetch_municipality(conn, args.municipality)

    print(
        f"Boost {meta['name']} id={meta['municipality_id']} "
        f"areas={args.areas} trees={args.trees} hedges={args.hedges}"
    )
    n_areas, n_assets = boost_one_municipality(
        meta,
        n_areas=args.areas,
        n_trees=args.trees,
        n_hedges=args.hedges,
        ingest_date=ingest_date,
        rng=rng,
    )
    print(f"Done. areas={n_areas} assets={n_assets}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
