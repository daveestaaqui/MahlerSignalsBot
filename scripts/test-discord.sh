#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
: "${DISCORD_WEBHOOK_URL_FREE:?Set DISCORD_WEBHOOK_URL_FREE in .env.local}"
TEXT="${1:-Hello from AuroraSignals}"
curl -fsS -H 'Content-Type: application/json' -d "{\"content\":\"${TEXT}\"}" "${DISCORD_WEBHOOK_URL_FREE}" >/dev/null && echo "✅ Discord ok"
