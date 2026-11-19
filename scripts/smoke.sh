#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
DB="$TMP/tasks.db"
DEV_DB="$ROOT/backend/data/tasks.db"
UVICORN_PID=""
VITE_PID=""

if [[ -e "$DEV_DB" ]]; then
  DEV_DB_STAMP="$(stat -c '%Y %s' "$DEV_DB")"
else
  DEV_DB_STAMP=""
fi

cleanup() {
  if [[ -n "$VITE_PID" ]]; then kill "$VITE_PID" 2>/dev/null || true; fi
  if [[ -n "$UVICORN_PID" ]]; then kill "$UVICORN_PID" 2>/dev/null || true; fi
  if [[ -n "$VITE_PID" ]]; then wait "$VITE_PID" 2>/dev/null || true; fi
  if [[ -n "$UVICORN_PID" ]]; then wait "$UVICORN_PID" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT

if [[ -x "$ROOT/backend/.venv/bin/uvicorn" ]]; then
  UVICORN="$ROOT/backend/.venv/bin/uvicorn"
else
  UVICORN="uvicorn"
fi

cd "$ROOT/backend"
TASKS_DATABASE_URL="sqlite:///$DB" "$UVICORN" app.main:app --host 127.0.0.1 --port 8000 >"$TMP/uvicorn.log" 2>&1 &
UVICORN_PID=$!

python3 - <<'PY'
import json, sys, time, urllib.request
deadline = time.time() + 5
while time.time() < deadline:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=0.2) as response:
            if json.load(response) == {"status": "ok"}:
                sys.exit(0)
    except Exception:
        time.sleep(0.1)
sys.stderr.write("backend health timeout\n")
sys.exit(1)
PY

cd "$ROOT/frontend"
npm run dev -- --host 127.0.0.1 --port 5173 >"$TMP/vite.log" 2>&1 &
VITE_PID=$!

python3 - <<'PY'
import json, sys, time, urllib.error, urllib.request

def call(method, path, payload=None, timeout=5):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request("http://127.0.0.1:5173" + path, data=data, method=method)
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            body = json.loads(raw) if raw else None
            return response.status, raw, body
    except urllib.error.HTTPError as error:
        raw = error.read()
        body = json.loads(raw) if raw else None
        return error.code, raw, body

deadline = time.time() + 10
proxied = False
while time.time() < deadline:
    try:
        status, _raw, body = call("GET", "/api/health", timeout=0.5)
        if status == 200 and body == {"status": "ok"}:
            proxied = True
            break
    except Exception:
        time.sleep(0.2)
if not proxied:
    sys.stderr.write("vite proxy timeout\n")
    sys.exit(1)

status, _raw, created = call("POST", "/api/tasks", {"title": "smoke"})
assert status == 201, (status, created)
assert created["status"] == "todo"
task_id = created["id"]

status, _raw, listed = call("GET", "/api/tasks")
assert status == 200
assert listed[0]["id"] == task_id
assert listed[0]["status"] == "todo"

status, _raw, updated = call("PATCH", f"/api/tasks/{task_id}", {"status": "done"})
assert status == 200, (status, updated)
assert updated["status"] == "done"

status, raw, _body = call("DELETE", f"/api/tasks/{task_id}")
assert status == 204
assert raw == b""

status, _raw, listed = call("GET", "/api/tasks")
assert status == 200
assert all(item["id"] != task_id for item in listed)

status, _raw, missing = call("DELETE", f"/api/tasks/{task_id}")
assert status == 404
assert missing["detail"] == "Task not found"
PY

if [[ -z "$DEV_DB_STAMP" ]]; then
  if [[ -e "$DEV_DB" ]]; then
    echo "smoke created $DEV_DB" >&2
    exit 1
  fi
else
  if [[ "$(stat -c '%Y %s' "$DEV_DB")" != "$DEV_DB_STAMP" ]]; then
    echo "smoke modified $DEV_DB" >&2
    exit 1
  fi
fi
