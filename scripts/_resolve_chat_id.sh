#!/usr/bin/env bash
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN first}"
TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo ""
  exit 0
fi
# Reject bot usernames
if [[ "$TARGET" =~ ^@.*[Bb][Oo][Tt]$ ]]; then
  echo ""
  exit 0
fi
if [[ "$TARGET" =~ ^@ ]]; then
  curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat" \
    --data-urlencode "chat_id=${TARGET}" | jq -r '.result.id // empty'
elif [[ "$TARGET" =~ ^-?[0-9]+$ ]]; then
  echo "$TARGET"
else
  echo ""
fi
