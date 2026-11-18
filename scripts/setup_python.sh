#!/bin/sh
set -e

if [ -x ".venv/bin/uvicorn" ] && .venv/bin/python -c "import fastapi, sqlalchemy, pandas, numpy" 2>/dev/null; then
  exit 0
fi

LOCK_DIR="/tmp/parkpulse_setup_python.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Python environment setup already in progress; waiting..."
  WAIT=0
  while [ -d "$LOCK_DIR" ] && [ "$WAIT" -lt 180 ]; do
    sleep 1
    WAIT=$((WAIT + 1))
  done
  if [ -x ".venv/bin/uvicorn" ] && .venv/bin/python -c "import fastapi, sqlalchemy, pandas, numpy" 2>/dev/null; then
    exit 0
  fi
  rmdir "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR" 2>/dev/null || true
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

echo "Setting up Python virtual environment for ParkPulse FastAPI backend..."
if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv --without-pip .venv
fi

if [ ! -x ".venv/bin/pip" ]; then
  curl -sSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
  .venv/bin/python /tmp/get-pip.py -q
fi

.venv/bin/pip install -q -r backend/requirements.txt
