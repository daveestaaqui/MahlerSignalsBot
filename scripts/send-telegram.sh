#!/usr/bin/env bash
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in env or .env.local}"
CHAT="${CHAT:-${TELEGRAM_CHAT_ID_FREE:-${TELEGRAM_CHAT_ID_PRO:-${TELEGRAM_CHAT_ID_ELITE:-}}}}"
MSG="${1:-Hello from AuroraSignalX}"
[ -z "$CHAT" ] && { echo "❌ No chat id. Set CHAT or TELEGRAM_CHAT_ID_PRO/ELITE."; exit 1; }
# Do NOT suppress output on failure; print Telegram response for diagnostics
resp="$(curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT}" \
  -d "text=${MSG}" \
  -d "disable_web_page_preview=true" \
  -d "allow_sending_without_reply=true" \
  -d "parse_mode=HTML" || true)"
ok="$(echo "$resp" | jq -r '.ok // false' 2>/dev/null || echo false)"
if [ "$ok" = "true" ]; then
  echo "✅ Telegram ok → chat=${CHAT}"
else
  echo "⚠️ Telegram error → chat=${CHAT}"
  if command -v jq >/dev/null 2>&1; then
    echo "$resp" | jq .
  else
    echo "$resp"
  fi
  exit 56
fi
