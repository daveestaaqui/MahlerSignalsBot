#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in .env.local}"
: "${TELEGRAM_CHAT_ID_FREE:?Set TELEGRAM_CHAT_ID_FREE in .env.local}"
TEXT="${1:-Hello from AuroraSignals}"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID_FREE}" -d "text=${TEXT}" -d "disable_web_page_preview=true" >/dev/null && echo "✅ Telegram ok"
