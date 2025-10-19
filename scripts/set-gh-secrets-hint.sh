#!/usr/bin/env bash
set -e
BASE_URL="${1:-https://YOUR-RENDER-URL}"
echo "Set these in GitHub → Settings → Secrets and variables → Actions"
echo "  ADMIN_ENDPOINT_URL = ${BASE_URL}/admin/post"
echo "  ADMIN_TOKEN        = <same value as on Render>"
echo ""
echo "Test call once deployed:"
echo "  curl -X POST ${BASE_URL}/admin/post -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' -sS"
