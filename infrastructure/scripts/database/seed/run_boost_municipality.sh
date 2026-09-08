#!/usr/bin/env bash
# =============================================================================
# Boost singolo comune → MinIO lakehouse (synthetic areas/assets + gold + catalog).
# PostGIS: solo lettura geometria comune / ids admin.
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
#   ./infrastructure/scripts/database/seed/run_boost_municipality.sh "L'Aquila"
#   AREAS=80 TREES=20000 HEDGES=2000 ./…/run_boost_municipality.sh Milano
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
LAKEHOUSE_DIR="$PROJECT_ROOT/infrastructure/scripts/database/lakehouse"
BOOST_PY="$SCRIPT_DIR/boost_municipality/boost_municipality_to_lakehouse.py"

cd "$COMPOSE_DIR"
# shellcheck disable=SC1091
source .env 2>/dev/null || true

if [[ -z "${1:-}" ]]; then
  echo "Uso: $0 <nome_comune>" >&2
  echo "Esempio: $0 Roma" >&2
  echo "         $0 \"L'Aquila\"" >&2
  exit 1
fi

MUNICIPALITY_RAW="$1"

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
echo "BOOST COMUNE → MinIO: $MUNICIPALITY_RAW"
echo "=============================================="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$BOOST_PY" --municipality "$MUNICIPALITY_RAW" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}

echo ""
echo "=============================================="
echo "BOOST COMPLETATO: $MUNICIPALITY_RAW"
echo "=============================================="
