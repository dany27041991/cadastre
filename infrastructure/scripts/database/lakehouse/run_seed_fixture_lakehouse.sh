#!/usr/bin/env bash
# Write fixture mosaic to MinIO + DuckDB catalog smoke (no PostGIS).
#
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/lakehouse/run_seed_fixture_lakehouse.sh
#   INGEST_DATE=2025-06-01 ./infrastructure/scripts/database/lakehouse/run_seed_fixture_lakehouse.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"

cd "$COMPOSE_DIR"
# shellcheck disable=SC1091
source .env 2>/dev/null || true

export LAKEHOUSE_S3_ENDPOINT="${LAKEHOUSE_S3_ENDPOINT_HOST:-http://localhost:${LAKEHOUSE_MINIO_API_PORT:-9000}}"
export LAKEHOUSE_S3_ACCESS_KEY="${LAKEHOUSE_S3_ACCESS_KEY:-cadastre_lake}"
export LAKEHOUSE_S3_SECRET_KEY="${LAKEHOUSE_S3_SECRET_KEY:-cadastre_lake_dev_change_me}"
export LAKEHOUSE_S3_BUCKET="${LAKEHOUSE_S3_BUCKET:-cadastre-lake}"
export LAKEHOUSE_S3_REGION="${LAKEHOUSE_S3_REGION:-us-east-1}"

PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import pyarrow, boto3, duckdb" 2>/dev/null; then
  echo "Installing lakehouse script deps…"
  "$PYTHON" -m pip install -q -r "$SCRIPT_DIR/requirements.txt"
fi

INGEST_ARGS=()
if [[ -n "${INGEST_DATE:-}" ]]; then
  INGEST_ARGS=(--ingest-date "$INGEST_DATE")
fi

"$PYTHON" "$SCRIPT_DIR/lakehouse_writer.py" --fixture ${INGEST_ARGS[@]+"${INGEST_ARGS[@]}"}

TODAY="${INGEST_DATE:-$(date +%F)}"
echo ""
echo "=== DuckDB smoke ==="
"$PYTHON" "$SCRIPT_DIR/smoke_duckdb_catalog.py" \
  --date-from "2000-01-01" --date-to "$TODAY" --municipality-id 999001
echo "OK"
