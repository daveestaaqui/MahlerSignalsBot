#!/usr/bin/env bash
set -euo pipefail

BOLD="$(tput bold 2>/dev/null || true)"
RESET="$(tput sgr0 2>/dev/null || true)"

edit_env_local(){
  local key="$1" val="$2"
  if [ ! -f .env.local ]; then cp -n .env.example .env.local 2>/dev/null || true; fi
  if grep -q "^${key}=" .env.local 2>/dev/null; then
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k{$2=v} {print}' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
  else
    echo "${key}=${val}" >> .env.local
  fi
}

echo "${BOLD}Telegram quick setup${RESET}"
read -r -p "Bot token (from BotFather): " TOKEN
if [ -z "$TOKEN" ]; then echo "❌ No token provided"; exit 1; fi
edit_env_local TELEGRAM_BOT_TOKEN "$TOKEN"

read -r -p "Chat target (@username or numeric id, optional): " TARGET
resolve(){
  local tok="$1" tgt="$2"
  if [[ "$tgt" =~ ^@ ]]; then
    curl -fsS "https://api.telegram.org/bot${tok}/getChat" --data-urlencode "chat_id=${tgt}" | jq -r '.result.id // empty'
  elif [[ "$tgt" =~ ^-?[0-9]+$ ]]; then
    echo "$tgt"
  else
    echo ""
  fi
}
CHAT_ID="$(resolve "$TOKEN" "${TARGET:-}")"
if [ -z "$CHAT_ID" ]; then
  cat <<'TIP'
Could not resolve chat id automatically.
1) Add your bot to the target chat.
2) Send a message in that chat.
3) Run:
   curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" | jq -r '..|.chat? | select(.id) | .id' | tail -1
TIP
  read -r -p "Paste numeric chat id: " CHAT_ID
fi
[ -z "$CHAT_ID" ] && { echo "❌ Still no chat id"; exit 2; }

edit_env_local TELEGRAM_CHAT_ID_FREE "$CHAT_ID"

echo "Sending test message…"
curl -fsS "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" -d "text=Hello from AuroraSignals 🚀" -d "disable_web_page_preview=true" >/dev/null \
  && echo "✅ Telegram ok" || { echo "⚠️ send failed"; exit 3; }

echo
cat <<MSG
${BOLD}Set these in Render → Service → Settings → Environment:${RESET}
  TELEGRAM_BOT_TOKEN=${TOKEN}
  TELEGRAM_CHAT_ID_FREE=${CHAT_ID}

Optional for gated tiers:
  TELEGRAM_CHAT_ID_PRO=...
  TELEGRAM_CHAT_ID_ELITE=...

Redeploy happens automatically after Save.
MSG
