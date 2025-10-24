#!/usr/bin/env bash
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN}"
CHAT_PRO="${TELEGRAM_CHAT_ID_PRO:-}"
CHAT_ELITE="${TELEGRAM_CHAT_ID_ELITE:-}"
echo "Bot info:"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq . || true
if [ -n "$CHAT_PRO" ]; then
  echo -e "\ngetChat (PRO $CHAT_PRO):"
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat" \
    --data-urlencode "chat_id=${CHAT_PRO}" | jq . || true
  echo -e "\ngetChatMember (PRO → bot):"
  BOT_ID="$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq -r '.result.id' 2>/dev/null || echo)"
  if [ -n "$BOT_ID" ]; then
    curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember" \
      --data-urlencode "chat_id=${CHAT_PRO}" \
      --data-urlencode "user_id=${BOT_ID}" | jq . || true
  else
    echo "(unable to determine bot id)"
  fi
fi
if [ -n "$CHAT_ELITE" ]; then
  echo -e "\ngetChat (ELITE $CHAT_ELITE):"
  curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat" \
    --data-urlencode "chat_id=${CHAT_ELITE}" | jq . || true
fi
echo -e "\nRecent updates (tail):"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" | jq '.result | (.[-5:] // .)' || true
