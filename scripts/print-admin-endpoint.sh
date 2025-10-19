#!/usr/bin/env bash
set -e
BASE_URL="${1:-https://YOUR-PRODUCTION-URL}"
echo "Set these GitHub Secrets:"
echo "  ADMIN_ENDPOINT_URL = ${BASE_URL}/admin/post"
echo "  ADMIN_TOKEN        = <same as server .env>"
