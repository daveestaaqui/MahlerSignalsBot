#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
URL="${BASE_URL:-https://aurora-signals.onrender.com}"
for p in / /status; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "${URL%/}$p")"
  echo "$p -> $code"
done
