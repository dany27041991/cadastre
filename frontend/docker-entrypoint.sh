#!/bin/sh
# Sync deps into the named node_modules volume (Linux), then start Vite.
set -e
cd /app

if [ ! -f package.json ]; then
  echo "docker-entrypoint: missing package.json in /app" >&2
  exit 1
fi

if [ ! -d node_modules/vite ] || [ ! -d node_modules/@mase/commons-geoinsight ]; then
  echo "docker-entrypoint: installing dependencies (Nexus via .npmrc)..."
  npm install --no-audit --no-fund --legacy-peer-deps
fi

if [ ! -d node_modules/@mase/commons-geoinsight ]; then
  echo "docker-entrypoint: @mase/commons-geoinsight missing after npm install." >&2
  echo "  Check VPN/network to Nexus and run: docker compose build frontend && docker compose up frontend" >&2
  exit 1
fi

BUNDLE_SRC="node_modules/@mase/commons-geoinsight/dist/mase-commons-geoinsight.js"
BUNDLE_PUBLIC="public/vendor/mase-commons-geoinsight.js"
BUNDLE_MIN_BYTES=6000000

public_size=0
if [ -f "$BUNDLE_PUBLIC" ]; then
  public_size=$(wc -c < "$BUNDLE_PUBLIC" | tr -d ' ')
fi

if [ "$public_size" -lt "$BUNDLE_MIN_BYTES" ] && [ -f "$BUNDLE_SRC" ]; then
  bundle_size=$(wc -c < "$BUNDLE_SRC" | tr -d ' ')
  if [ "$bundle_size" -lt "$BUNDLE_MIN_BYTES" ]; then
    echo "docker-entrypoint: geoinsight bundle truncated in node_modules (${bundle_size}B) — reinstalling (VPN required)..."
    npm install @mase/commons-geoinsight --no-audit --no-fund --legacy-peer-deps || true
  fi
fi

sh /app/scripts/sync-geoinsight-bundle.sh

# Vite loadEnv reads .env files; compose injects VITE_* via process.env only.
if [ -n "$VITE_MOCK_FGP" ] || [ -n "$VITE_MOCK_COOKIE" ]; then
  {
    printf 'VITE_MASE_API_ORIGIN=%s\n' "${VITE_MASE_API_ORIGIN:-https://sim-dev.mase.gov.it}"
    [ -n "$VITE_MOCK_FGP" ] && printf 'VITE_MOCK_FGP=%s\n' "$VITE_MOCK_FGP"
    [ -n "$VITE_MOCK_COOKIE" ] && printf 'VITE_MOCK_COOKIE="%s"\n' "$(printf '%s' "$VITE_MOCK_COOKIE" | sed 's/"/\\"/g')"
  } > /app/.env.local
fi

if [ ! -f "$BUNDLE_PUBLIC" ] || [ "$(wc -c < "$BUNDLE_PUBLIC" | tr -d ' ')" -lt "$BUNDLE_MIN_BYTES" ]; then
  echo "docker-entrypoint: geoinsight bundle unavailable in $BUNDLE_PUBLIC." >&2
  echo "  Copy from host: cp node_modules/@mase/commons-geoinsight/dist/mase-commons-geoinsight.js public/vendor/" >&2
  exit 1
fi

exec node node_modules/vite/bin/vite.js --host 0.0.0.0 "$@"
