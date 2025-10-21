#!/usr/bin/env bash
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in env or export it before running.}"
TARGET="${1:-}"
if [ -n "$TARGET" ]; then
  curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat" \
    -d "chat_id=${TARGET}" | jq -r '.result.id // empty'
  exit 0
fi
cat <<'MSG'
1) Add the bot to your group/channel.
2) Send a test message in that chat.
3) Run:
   curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" | \
     jq -r '..|.chat? | select(.id) | .id' | tail -1
MSG
