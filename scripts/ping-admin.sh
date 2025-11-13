#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
URL="${BASE_URL:-https://api.manysignals.finance}"
TOK="${ADMIN_TOKEN:?Set ADMIN_TOKEN in .env.local}"
curl -fsS -X POST "${URL%/}/admin/post" -H "Authorization: Bearer ${TOK}" -d '' && echo && echo "ok"
