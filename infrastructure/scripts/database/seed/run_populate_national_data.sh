#!/usr/bin/env bash
# =============================================================================
# Seed nazionale → MinIO lakehouse (wipe opzionale + parallel + checkpoint + rollup).
# PostGIS: lettura comuni; scrittura solo MinIO.
# Design: docs/design/2026-09-09-national-mock-lakehouse-seed-design.md
# =============================================================================
# Uso (dalla root progetto cadastre/):
#   ./infrastructure/scripts/database/seed/run_populate_national_data.sh --dry-run
#   ./infrastructure/scripts/database/seed/run_populate_national_data.sh \
#     --region "Valle d'Aosta" --limit 2 --trees 50 --workers 2
#   ./infrastructure/scripts/database/seed/run_populate_national_data.sh \
#     --wipe --workers 4 --trees 1200 --hedges 80 --areas 8
#   ./infrastructure/scripts/database/seed/run_populate_national_data.sh --resume --workers 4
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
LAKEHOUSE_DIR="$PROJECT_ROOT/infrastructure/scripts/database/lakehouse"
NATIONAL_PY="$SCRIPT_DIR/populate_national_data/seed_populate_national_data.py"
WIPE_PY="$SCRIPT_DIR/wipe_green_lakehouse.py"

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

HOST_S3_ENDPOINT="${LAKEHOUSE_S3_ENDPOINT_HOST:-http://localhost:${LAKEHOUSE_MINIO_API_PORT:-9000}}"

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import pyarrow, boto3, shapely, psycopg" 2>/dev/null; then
  echo "Installing lakehouse deps…"
  "$PYTHON" -m pip install -q -r "$LAKEHOUSE_DIR/requirements.txt"
fi

WIPE=0
SKIP_ROLLUP=0
PASS_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wipe)
      WIPE=1
      shift
      ;;
    --skip-rollup)
      SKIP_ROLLUP=1
      shift
      ;;
    *)
      PASS_ARGS+=("$1")
      shift
      ;;
  esac
done

EXTRA_ARGS=()
[[ -n "${AREAS:-}" ]] && EXTRA_ARGS+=(--areas "$AREAS")
[[ -n "${TREES:-}" ]] && EXTRA_ARGS+=(--trees "$TREES")
[[ -n "${HEDGES:-}" ]] && EXTRA_ARGS+=(--hedges "$HEDGES")
[[ -n "${WORKERS:-}" ]] && EXTRA_ARGS+=(--workers "$WORKERS")
if [[ -n "${INGEST_DATES:-}" ]]; then
  EXTRA_ARGS+=(--ingest-dates "$INGEST_DATES")
elif [[ -n "${INGEST_DATE:-}" ]]; then
  EXTRA_ARGS+=(--ingest-date "$INGEST_DATE")
fi
[[ -n "${DATA_DIR:-}" ]] && EXTRA_ARGS+=(--data-dir "$DATA_DIR")

if [[ "$WIPE" -eq 1 ]]; then
  echo "=============================================="
  echo "WIPE green lakehouse prefixes"
  echo "=============================================="
  LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
    "$PYTHON" "$WIPE_PY" --yes
  echo ""
fi

echo "=============================================="
echo "POPULATE NATIONAL → MinIO lakehouse"
echo "=============================================="
LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
  "$PYTHON" "$NATIONAL_PY" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} ${PASS_ARGS[@]+"${PASS_ARGS[@]}"}

if [[ "$SKIP_ROLLUP" -eq 0 ]]; then
  # Skip rollup on dry-run
  if [[ " ${PASS_ARGS[*]} " != *" --dry-run "* ]]; then
    echo ""
    echo "=============================================="
    echo "ADMIN GOLD ROLLUP"
    echo "=============================================="
    LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
      "$PYTHON" "$LAKEHOUSE_DIR/rollup_admin_gold.py"

    echo ""
    echo "=============================================="
    echo "ADMIN AREAS STATS ROLLUP"
    echo "=============================================="
    LAKEHOUSE_S3_ENDPOINT="$HOST_S3_ENDPOINT" \
      "$PYTHON" "$LAKEHOUSE_DIR/rollup_admin_areas_stats.py"
  fi
fi

echo ""
echo "=============================================="
echo "POPULATE NATIONAL COMPLETATO"
echo "=============================================="
