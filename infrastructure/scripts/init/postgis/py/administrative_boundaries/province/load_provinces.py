"""
Load public.provinces from province/provinces.geojson.
Depends on public.regions. Properties: COD_REG → region_id, COD_UTS → code, DEN_UTS/DEN_CM → name, SIGLA, geometry.
"""
import json

import config


def load(conn):
    path = config.get_data_dir() / "province" / "provinces.geojson"
    if not path.exists():
        print(f"  Skip provinces: {path} not found")
        return 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    count = 0
    with conn.cursor() as cur:
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            cod_reg = props.get("COD_REG")
            if cod_reg is None:
                continue
            reg_code = str(int(cod_reg)).zfill(2) if isinstance(cod_reg, (int, float)) else str(cod_reg)
            cod_uts = props.get("COD_UTS")
            if cod_uts is None:
                continue
            code = str(int(cod_uts))
            den_uts = (props.get("DEN_UTS") or "").strip()
            den_cm = (props.get("DEN_CM") or "").strip()
            name = den_uts if den_uts and den_uts != "-" else (den_cm if den_cm and den_cm != "-" else code)
            sigla = (props.get("SIGLA") or "").strip() or None
            geom = config.geom_to_geojson(feat)
            cur.execute(
                """
                INSERT INTO public.provinces (code, name, vehicle_registration_code, region_id, geometry)
                SELECT %s, %s, %s, r.id, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(%s)), 4326)
                FROM public.regions r WHERE r.code = %s
                ON CONFLICT (code, region_id) DO UPDATE SET
                  name = EXCLUDED.name,
                  vehicle_registration_code = COALESCE(EXCLUDED.vehicle_registration_code, provinces.vehicle_registration_code),
                  geometry = EXCLUDED.geometry
                """,
                (code, name, sigla, geom, reg_code),
            )
            count += 1
    print(f"  Provinces: {count}")
    return count
