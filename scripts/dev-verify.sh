#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL env required}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN env required}"

curl -sSf "$BASE_URL/status" >/dev/null
curl -sSf "$BASE_URL/diagnostics" >/dev/null
curl -sSf "$BASE_URL/weekly-summary" >/dev/null

curl -sSf -X POST "$BASE_URL/admin/post-daily" -H "Authorization: Bearer $ADMIN_TOKEN" >/dev/null
curl -sSf -X POST "$BASE_URL/admin/post-weekly" -H "Authorization: Bearer $ADMIN_TOKEN" >/dev/null
curl -sSf -X POST "$BASE_URL/admin/post-now" -H "Authorization: Bearer $ADMIN_TOKEN" >/dev/null

echo "verification succeeded"
