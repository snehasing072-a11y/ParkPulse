#!/bin/sh
set -e

(
  sh scripts/setup_python.sh
  .venv/bin/python -c "
import os, signal, glob
for p in glob.glob('/proc/[0-9]*/cmdline'):
    try:
        cmd = open(p, 'rb').read().replace(b'\x00', b' ').decode('utf-8', 'ignore')
        if 'uvicorn backend.main:app' in cmd:
            pid = int(p.split('/')[2])
            if pid != os.getpid():
                os.kill(pid, signal.SIGTERM)
    except Exception:
        pass
" 2>/dev/null || true
  exec .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001
) >/tmp/parkpulse_backend.log 2>&1 &
BACKEND_SUPERVISOR_PID=$!
trap 'kill $BACKEND_SUPERVISOR_PID 2>/dev/null || true' EXIT INT TERM

exec ./node_modules/.bin/vite --port=3000 --host=0.0.0.0
