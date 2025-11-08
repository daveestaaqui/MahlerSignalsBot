#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

echo "Starting dev server in background..."
node dist/web/server.js &
PID=$!

sleep 3

echo "Running endpoint smoke test against ${BASE}..."
BASE="$BASE" node scripts/check-endpoints.mjs || true

echo "Stopping dev server (PID=${PID})..."
kill "$PID" || true
