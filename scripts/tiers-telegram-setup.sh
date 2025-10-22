#!/usr/bin/env bash
set -euo pipefail
BOLD="$(tput bold 2>/dev/null || true)"; RESET="$(tput sgr0 2>/dev/null || true)"

edit_env(){
  local key="$1" val="$2"
  [ -f .env.local ] || cp -n .env.example .env.local 2>/dev/null || true
  if grep -q "^${key}=" .env.local 2>/dev/null; then
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k{$2=v}1' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
  else
    echo "${key}=${val}" >> .env.local
  fi
}

resolve(){
  TELEGRAM_BOT_TOKEN="$1" TELEGRAM_CHAT_ID_FREE="dummy" ./scripts/_resolve_chat_id.sh "$2"
}

printf "%sTelegram PRO/ELITE setup%s\n" "$BOLD" "$RESET"
read -r -p "Bot token (from BotFather): " TOKEN
[ -z "$TOKEN" ] && { echo "❌ token required"; exit 1; }
edit_env TELEGRAM_BOT_TOKEN "$TOKEN"
export TELEGRAM_BOT_TOKEN="$TOKEN"

DEFAULT_PRO="@AuroraSignalX_pro"
DEFAULT_ELITE="@AuroraSignalX_elite"
read -r -p "PRO channel [${DEFAULT_PRO}]: " PRO
PRO="${PRO:-$DEFAULT_PRO}"
PRO_ID="$(resolve "$TOKEN" "$PRO")"
if [ -z "$PRO_ID" ]; then
  echo "Could not auto-resolve. Use getUpdates fallback (bot must be member)."
  read -r -p "Paste PRO numeric chat id: " PRO_ID
fi
[ -z "$PRO_ID" ] && { echo "❌ PRO chat id missing"; exit 2; }
edit_env TELEGRAM_CHAT_ID_PRO "$PRO_ID"

read -r -p "ELITE channel [${DEFAULT_ELITE}]: " ELITE
ELITE="${ELITE:-$DEFAULT_ELITE}"
ELITE_ID="$(resolve "$TOKEN" "$ELITE")"
if [ -z "$ELITE_ID" ]; then
  echo "Could not auto-resolve. Paste numeric chat id (use getUpdates)"
  read -r -p "Paste ELITE numeric chat id: " ELITE_ID
fi
[ -z "$ELITE_ID" ] && { echo "❌ ELITE chat id missing"; exit 3; }
edit_env TELEGRAM_CHAT_ID_ELITE "$ELITE_ID"

send(){ local id="$1" text="$2"; curl -fsS "https://api.telegram.org/bot${TOKEN}/sendMessage" -d "chat_id=${id}" -d "text=${text}" -d "disable_web_page_preview=true" >/dev/null && echo "✅ ${text}" || echo "⚠️ send failed"; }
send "$PRO_ID" "PRO sanity ✅"
send "$ELITE_ID" "ELITE sanity 👑"

echo
cat <<MSG
${BOLD}Update Render → Environment with:${RESET}
  TELEGRAM_BOT_TOKEN=${TOKEN}
  TELEGRAM_CHAT_ID_PRO=${PRO_ID}
  TELEGRAM_CHAT_ID_ELITE=${ELITE_ID}
Then Save (Render redeploys automatically).

Test locally:
  make tg-pro
  make tg-elite
MSG
