#!/bin/sh
# Copy Geoinsight AMD bundle to public/vendor for raw serving (avoids Vite ESM transform).
set -e
cd "$(dirname "$0")/.."

SRC="node_modules/@mase/commons-geoinsight/dist/mase-commons-geoinsight.js"
DEST="public/vendor/mase-commons-geoinsight.js"
MIN_BYTES=6000000

mkdir -p public/vendor

if [ -f "$DEST" ]; then
  dest_size=$(wc -c < "$DEST" | tr -d ' ')
  if [ "$dest_size" -ge "$MIN_BYTES" ]; then
    exit 0
  fi
fi

if [ ! -f "$SRC" ]; then
  echo "sync-geoinsight-bundle: source missing ($SRC) and no valid $DEST" >&2
  exit 1
fi

src_size=$(wc -c < "$SRC" | tr -d ' ')
if [ "$src_size" -lt "$MIN_BYTES" ]; then
  echo "sync-geoinsight-bundle: source truncated (${src_size}B) and no valid $DEST" >&2
  exit 1
fi

cp "$SRC" "$DEST"
echo "sync-geoinsight-bundle: copied ${src_size}B -> $DEST"
