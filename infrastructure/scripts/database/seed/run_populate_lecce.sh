#!/usr/bin/env bash
# =============================================================================
# Seed Lecce GeoJSON → MinIO lakehouse (silver + gold + catalog).
# PostGIS used only for municipality / attribute_type lookups.
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_populate_lecce.sh
#   INGEST_DATE=2025-06-01 ./infrastructure/scripts/database/seed/run_populate_lecce.sh
# =============================================================================
# Requisiti: PostGIS + MinIO up; comune Lecce in public.municipalities;
# GeoJSON in infrastructure/data/municipality/lecce/; pip deps lakehouse + geopandas.
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
LAKEHOUSE_DIR="$PROJECT_ROOT/infrastructure/scripts/database/lakehouse"
LECCE_PY="$SCRIPT_DIR/populate_lecce_data/load_lecce_green_data.py"

cd "$COMPOSE_DIR"
# shellcheck disable=SC1091
source .env 2>/dev/null || true

export LAKEHOUSE_S3_ACCESS_KEY="${LAKEHOUSE_S3_ACCESS_KEY:-cadastre_lake}"
export LAKEHOUSE_S3_SECRET_KEY="${LAKEHOUSE_S3_SECRET_KEY:-cadastre_lake_dev_change_me}"
export LAKEHOUSE_S3_BUCKET="${LAKEHOUSE_S3_BUCKET:-cadastre-lake}"
export LAKEHOUSE_S3_REGION="${LAKEHOUSE_S3_REGION:-us-east-1}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER:-cadastre}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB:-arboreal_green_cadastre}}"
export DATA_DIR="${DATA_DIR:-$PROJECT_ROOT/infrastructure/data}"

# Host-side MinIO URL only for this Python process (do NOT export LAKEHOUSE_S3_ENDPOINT —
# that would override compose interpolation to localhost and break the backend container).
HOST_S3_ENDPOINT="${LAKEHOUSE_S3_ENDPOINT_HOST:-http://localhost:${LAKEHOUSE_MINIO_API_PORT:-9000}}"

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import pyarrow, boto3, geopandas, shapely, psycopg" 2>/dev/null; then
  echo "Installing lakehouse + geospatial deps…"
  "$PYTHON" -m pip install -q -r "$LAKEHOUSE_DIR/requirements.txt"
fi

INGEST_ARGS=()
if [[ -n "${INGEST_DATE:-}" ]]; then
  INGEST_ARGS=(--ingest-date "$INGEST_DATE")
fi

echo "=============================================="
echo "POPULATE LECCE → MinIO lakehouse"
echo "=============================================="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$LECCE_PY" --municipality Lecce ${INGEST_ARGS[@]+"${INGEST_ARGS[@]}"}

TODAY="${INGEST_DATE:-$(date +%F)}"
echo ""
echo "=== DuckDB smoke ==="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$LAKEHOUSE_DIR/smoke_duckdb_catalog.py" --date-from "2000-01-01" --date-to "$TODAY" || true

echo ""
echo "=============================================="
echo "POPULATE LECCE COMPLETATO"
echo "=============================================="
