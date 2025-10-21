#!/usr/bin/env bash
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN (env/.env.local).}"
CHAT="${TELEGRAM_CHAT_ID_FREE:-}"
MSG="${1:-Hello from AuroraSignals}"
if [ -z "$CHAT" ]; then
  echo "Usage: TELEGRAM_CHAT_ID_FREE=<id> ./scripts/send-telegram.sh 'Message'" >&2
  exit 1
fi
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT}" -d "text=${MSG}" -d "disable_web_page_preview=true" >/dev/null && echo "✅ Telegram ok"
