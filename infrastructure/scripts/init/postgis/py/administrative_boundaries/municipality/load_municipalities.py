"""
Load public.municipalities from municipality/municipalities.geojson.
Depends on public.provinces. Properties: PRO_COM_T → istat_code, COMUNE → name, COD_REG+COD_UTS → province_id, geometry.
"""
import json

import config


def load(conn):
    path = config.get_data_dir() / "municipality" / "municipalities.geojson"
    if not path.exists():
        print(f"  Skip municipalities: {path} not found")
        return 0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    count = 0
    with conn.cursor() as cur:
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            pro_com_t = props.get("PRO_COM_T")
            if not pro_com_t:
                continue
            istat_code = str(pro_com_t).zfill(6) if isinstance(pro_com_t, (int, float)) else str(pro_com_t).strip()
            name = (props.get("COMUNE") or "").strip() or None
            if not name:
                continue
            cod_reg = props.get("COD_REG")
            cod_uts = props.get("COD_UTS")
            if cod_reg is None or cod_uts is None:
                continue
            reg_code = str(int(cod_reg)).zfill(2) if isinstance(cod_reg, (int, float)) else str(cod_reg)
            prov_code = str(int(cod_uts))
            geom = config.geom_to_geojson(feat)
            cur.execute(
                """
                INSERT INTO public.municipalities (istat_code, name, province_id, geometry)
                SELECT %s, %s, p.id, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(%s)), 4326)
                FROM public.provinces p
                JOIN public.regions r ON r.id = p.region_id
                WHERE r.code = %s AND p.code = %s
                ON CONFLICT (istat_code) DO UPDATE SET
                  name = EXCLUDED.name,
                  geometry = EXCLUDED.geometry
                """,
                (istat_code, name, geom, reg_code, prov_code),
            )
            count += 1
    print(f"  Municipalities: {count}")
    return count
