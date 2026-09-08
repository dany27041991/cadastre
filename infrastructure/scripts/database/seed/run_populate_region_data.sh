#!/usr/bin/env bash
# =============================================================================
# Seed regione → MinIO lakehouse (synthetic boost per municipality).
# PostGIS: lettura comuni della regione; scrittura solo MinIO.
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_populate_region_data.sh --region "Valle d'Aosta"
#   ./infrastructure/scripts/database/seed/run_populate_region_data.sh --region 2 --limit 3
#   AREAS=10 TREES=200 ./…/run_populate_region_data.sh --region Puglia --dry-run
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
LAKEHOUSE_DIR="$PROJECT_ROOT/infrastructure/scripts/database/lakehouse"
REGION_PY="$SCRIPT_DIR/populate_region_data/seed_populate_region_data.py"

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

# Host-side MinIO URL only for this Python process (do NOT export LAKEHOUSE_S3_ENDPOINT —
# that would override compose interpolation to localhost and break the backend container).
HOST_S3_ENDPOINT="${LAKEHOUSE_S3_ENDPOINT_HOST:-http://localhost:${LAKEHOUSE_MINIO_API_PORT:-9000}}"

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import pyarrow, boto3, shapely, psycopg" 2>/dev/null; then
  echo "Installing lakehouse deps…"
  "$PYTHON" -m pip install -q -r "$LAKEHOUSE_DIR/requirements.txt"
fi

EXTRA_ARGS=()
[[ -n "${AREAS:-}" ]] && EXTRA_ARGS+=(--areas "$AREAS")
[[ -n "${TREES:-}" ]] && EXTRA_ARGS+=(--trees "$TREES")
[[ -n "${HEDGES:-}" ]] && EXTRA_ARGS+=(--hedges "$HEDGES")
[[ -n "${INGEST_DATE:-}" ]] && EXTRA_ARGS+=(--ingest-date "$INGEST_DATE")

echo "=============================================="
echo "POPULATE REGION → MinIO lakehouse"
echo "=============================================="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$REGION_PY" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} "$@"

echo ""
echo "=============================================="
echo "ADMIN GOLD ROLLUP (per-region municipality bands)"
echo "=============================================="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$LAKEHOUSE_DIR/rollup_admin_gold.py"

echo ""
echo "=============================================="
echo "POPULATE REGION COMPLETATO"
echo "=============================================="
