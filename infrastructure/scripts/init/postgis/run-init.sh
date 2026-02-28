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

# Wait for Postgres to accept connections (avoids race when started with compose up)
echo "Waiting for Postgres at postgis:5432..."
max=30
n=0
until pg_isready -h postgis -p 5432 -U "$U" -d "$D"; do
  n=$((n + 1))
  if [ "$n" -ge "$max" ]; then
    echo "Error: Postgres not ready after ${max} attempts"
    exit 1
  fi
  echo "  attempt $n/$max..."
  sleep 2
done
echo "Postgres ready."

echo "Init: schema public (01) + catalog seed (01–04) + cadastre (02) + cadastre seed (02b)..."
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-schema-public.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-seed-01-area-level.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-seed-02-primary-types.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-seed-03-secondary-types.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/01-init-seed-04-attribute-types.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/02-init-schema-cadastre.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/02b-seed-cadastre-catalog.sql
echo "Init: indexes public (03) + cadastre (04)..."
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/03-init-indexes-public.sql
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/04-init-indexes-cadastre.sql

echo "Init: load territorial data from GeoJSON..."
python3 /scripts/init/postgis/py/administrative_boundaries/load_geojson.py

echo "Init: create partitions (requires regions/provinces populated)..."
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/06-create-partitions.sql

echo "Init: autovacuum tuning on leaf partitions (05, after 06 so all leaves exist)..."
psql -q -h postgis -U "$U" -d "$D" -f /scripts/init/postgis/sql/05-autovacuum-tuning.sql

echo "Init done."
