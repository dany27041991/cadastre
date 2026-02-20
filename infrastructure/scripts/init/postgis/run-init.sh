#!/usr/bin/env sh
# =============================================================================
# Tree Cadastre - PostGIS init: schema (01-05) + load territorial data from GeoJSON
# =============================================================================
# Run INSIDE the init container (or via: docker compose run --rm init sh /scripts/init/postgis/run-init.sh).
# Expects: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB; /scripts and /data (or DATA_DIR) mounted.
# GeoJSON files: /data/region, /data/province, /data/municipality, /data/section, /data/submunicipal.
# =============================================================================

set -e

U="${POSTGRES_USER:-cadastre}"
D="${POSTGRES_DB:-arboreal_green_cadastre}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "Init: schema public (01) + catalog seed (01b) + cadastre (02)..."
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-schema-public.sql
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01b-seed-public-catalog.sql
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/02-init-schema-cadastre.sql
echo "Init: indexes public (03) + cadastre (04)..."
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/03-init-indexes-public.sql
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/04-init-indexes-cadastre.sql

echo "Init: load territorial data from GeoJSON..."
python3 /scripts/init/postgis/py/administrative_boundaries/load_geojson.py

echo "Init: create partitions (requires regions/provinces populated)..."
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/06-create-partitions.sql

echo "Init: autovacuum tuning on leaf partitions (05, after 06 so all leaves exist)..."
psql -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/05-autovacuum-tuning.sql

echo "Init done."
