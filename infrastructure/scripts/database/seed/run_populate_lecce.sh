#!/usr/bin/env bash
# =============================================================================
# Popola green_areas e green_assets da GeoJSON per Lecce.
# Carica prima areas.geojson, poi hedges/shrubs/trees associandoli alle aree.
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_populate_lecce.sh
#   → dati in infrastructure/data/municipality/lecce/
# =============================================================================
# Requisiti: stack Docker avviato (postgis + init già eseguito), comune presente
# in public.municipalities. File attesi: areas.geojson, hedges.geojson,
# shrubs.geojson, trees.geojson in DATA_DIR/municipality/lecce/.
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
cd "$COMPOSE_DIR"
source .env 2>/dev/null || true

# JWT_SECRET_KEY is required by docker-compose.yml (backend); not used by init.
# Set placeholder so "docker compose run init" can parse the file when only seeding.
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-placeholder-for-seed-scripts}"

# In container: script e dati sono sotto /scripts e /data
export DATA_DIR="${DATA_DIR:-/data}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER:-cadastre}:${POSTGRES_PASSWORD}@postgis:5432/${POSTGRES_DB:-arboreal_green_cadastre}}"

echo "=============================================="
echo "POPULATE LECCE"
echo "=============================================="
docker compose run --rm \
  -e DATA_DIR \
  -e DATABASE_URL \
  init \
  python3 /scripts/database/seed/populate_lecce_data/load_lecce_green_data.py \
  --municipality Lecce

echo ""
echo "=============================================="
echo "POPULATE LECCE COMPLETATO"
echo "=============================================="
