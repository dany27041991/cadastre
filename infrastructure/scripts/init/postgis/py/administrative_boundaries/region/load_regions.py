"""
Load public.regions from region/regions.geojson.
Properties: COD_REG → code, DEN_REG → name, geometry.
Upsert on code: no duplicates on re-run.
"""
import json

import config


def load(conn):
    path = config.get_data_dir() / "region" / "regions.geojson"
    if not path.exists():
        print(f"  Skip regions: {path} not found")
        return 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    count = 0
    with conn.cursor() as cur:
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            code = props.get("COD_REG")
            if code is None:
                continue
            code = str(int(code)).zfill(2) if isinstance(code, (int, float)) else str(code)
            name = (props.get("DEN_REG") or "").strip() or None
            if not name:
                continue
            geom = config.geom_to_geojson(feat)
            cur.execute(
                """
                INSERT INTO public.regions (code, name, geometry)
                VALUES (%s, %s, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(%s)), 4326))
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, geometry = EXCLUDED.geometry
                """,
                (code, name, geom),
            )
            count += 1
    print(f"  Regions: {count}")
    return count
