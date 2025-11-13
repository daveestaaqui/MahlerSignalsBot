#!/usr/bin/env bash
set -euo pipefail
NEW="$(openssl rand -hex 24 2>/dev/null || python3 - <<PY
import secrets; print(secrets.token_hex(24))
PY
)"
source ./.env.local 2>/dev/null || true
BASE="${BASE_URL:-https://api.manysignals.finance}"
echo "Generated NEW ADMIN_TOKEN:" && echo "  ${NEW}" && echo
echo "1) Set it on Render:" && echo "   Render → Services → aurora-signals → Settings → Environment" && echo "   ADMIN_TOKEN = ${NEW}  (Save; redeploy)" && echo
echo "2) Update GitHub Actions secret:" && echo "   gh secret set ADMIN_TOKEN -b \"${NEW}\"" && echo
echo "3) Test once redeployed:" && echo "   curl -X POST \"${BASE%/}/admin/post\" -H 'Authorization: Bearer ${NEW}' -sS"
