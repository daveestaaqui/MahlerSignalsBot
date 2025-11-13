#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://aurora-signals.onrender.com}"
echo "ℹ️  Checking production API at ${BASE_URL}"

paths=(
  "/healthz"
  "/status"
  "/diagnostics"
  "/signals/today"
  "/marketing/preview"
)

for path in "${paths[@]}"; do
  url="${BASE_URL%/}${path}"
  printf '→ GET %s\n' "$url"
  curl -fsS -w '\nHTTP %{http_code}\n' "$url" | head -c 480 || true
  echo
done
