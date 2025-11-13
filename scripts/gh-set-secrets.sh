#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
URL="${BASE_URL:-https://aurora-signals.onrender.com}"
TOK="${ADMIN_TOKEN:?Set ADMIN_TOKEN in .env.local}"
gh secret set ADMIN_ENDPOINT_URL -b "${URL%/}/admin/post"
gh secret set ADMIN_TOKEN        -b "${TOK}"
echo "✅ GitHub Actions secrets set for ${URL%/}/admin/post"
