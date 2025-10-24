#!/usr/bin/env bash
set -euo pipefail
: "${DISCORD_WEBHOOK_URL_FREE:?Set DISCORD_WEBHOOK_URL_FREE in .env.local and in Render}"
MSG="${1:-Hello from AuroraSignalX}"
curl -fsS -H 'Content-Type: application/json' -d "{\"content\":\"${MSG}\"}" "$DISCORD_WEBHOOK_URL_FREE" >/dev/null && echo "✅ Discord ok"
