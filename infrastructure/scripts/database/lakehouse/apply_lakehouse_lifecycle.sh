#!/usr/bin/env bash
# Apply MinIO ILM retention on lakehouse prefixes (T7).
# Keeps catalog forever; expires object versions under silver/gold after N days.
#
# Usage (MinIO up, mc available — or via compose minio/mc image):
#   RETENTION_DAYS=90 ./apply_lakehouse_lifecycle.sh
#
# Docs: cadastre/docs/infrastructure/lakehouse-hardening.md
set -euo pipefail

ENDPOINT="${LAKEHOUSE_S3_ENDPOINT:-http://localhost:9000}"
ACCESS="${LAKEHOUSE_S3_ACCESS_KEY:-cadastre_lake}"
SECRET="${LAKEHOUSE_S3_SECRET_KEY:-cadastre_lake_dev_change_me}"
BUCKET="${LAKEHOUSE_S3_BUCKET:-cadastre-lake}"
DAYS="${RETENTION_DAYS:-90}"
ALIAS="${MC_ALIAS:-cadastre-lake-local}"

if ! command -v mc >/dev/null 2>&1; then
  echo "mc (MinIO client) required on PATH" >&2
  exit 1
fi

mc alias set "$ALIAS" "$ENDPOINT" "$ACCESS" "$SECRET" >/dev/null

# Non-current / aged objects under data prefixes (not _catalog/).
# Rule id is stable for idempotent re-apply.
RULE_ID="expire-green-parquet-${DAYS}d"

mc ilm rule remove --id "$RULE_ID" "$ALIAS/$BUCKET" 2>/dev/null || true

mc ilm rule add \
  --expire-days "$DAYS" \
  --prefix "green_assets/" \
  --id "${RULE_ID}-assets" \
  "$ALIAS/$BUCKET"

mc ilm rule add \
  --expire-days "$DAYS" \
  --prefix "green_areas/" \
  --id "${RULE_ID}-areas" \
  "$ALIAS/$BUCKET"

mc ilm rule add \
  --expire-days "$DAYS" \
  --prefix "green_assets_clusters/" \
  --id "${RULE_ID}-clusters" \
  "$ALIAS/$BUCKET"

echo "ILM applied on s3://$BUCKET (expire ${DAYS}d under green_* ; _catalog untouched)"
mc ilm rule ls "$ALIAS/$BUCKET"
