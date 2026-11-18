#!/bin/sh
set -e

if command -v python3 >/dev/null 2>&1; then
  sh scripts/setup_python.sh
  exec .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-3000}"
else
  echo "python3 is unavailable in this runtime; starting Cloud Run fallback server..."
  exec node scripts/cloudrun_server.mjs
fi
