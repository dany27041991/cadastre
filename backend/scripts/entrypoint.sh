#!/bin/sh
# Entrypoint backend: se DEBUGPY_ENABLE=1 avvia uvicorn sotto debugpy (porta 5678) per attach IDE.
set -e
if [ "$DEBUGPY_ENABLE" = "1" ] || [ "$DEBUGPY_ENABLE" = "true" ]; then
  exec python -m debugpy --listen 0.0.0.0:5678 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
  exec "$@"
fi
