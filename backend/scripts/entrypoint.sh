#!/bin/sh
# Entrypoint backend: ensure lakehouse DuckDB, then optionally debugpy, then CMD.
set -e
# DuckDB may be missing if the image was built before lakehouse-only or rebuild skipped deps.
python -c "import duckdb" 2>/dev/null || pip install --no-cache-dir "duckdb>=1.1.0"
if [ "$DEBUGPY_ENABLE" = "1" ] || [ "$DEBUGPY_ENABLE" = "true" ]; then
  exec python -m debugpy --listen 0.0.0.0:5678 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
  exec "$@"
fi
