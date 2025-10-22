#!/usr/bin/env bash
set -euo pipefail
f=.env.local; [ -f "$f" ] || { echo "⚠️  $f missing"; exit 0; }
get(){ grep -E "^$1=" "$f" | tail -1 | cut -d= -f2-; }
ok(){ [ -n "$1" ] && echo "✅" || echo "❌"; }

BASE_URL="$(get BASE_URL)"
ADMIN_TOKEN_SET="$(get ADMIN_TOKEN)"
TG_TOKEN="$(get TELEGRAM_BOT_TOKEN)"
TG_PRO="$(get TELEGRAM_CHAT_ID_PRO)"
TG_ELITE="$(get TELEGRAM_CHAT_ID_ELITE)"
DC_FREE="$(get DISCORD_WEBHOOK_URL_FREE)"
XK="$(get X_API_KEY)"; XS="$(get X_API_SECRET)"; XT="$(get X_ACCESS_TOKEN)"; XTS="$(get X_ACCESS_TOKEN_SECRET)"
SP="$(get STRIPE_SECRET_KEY)"; SWH="$(get STRIPE_WEBHOOK_SECRET)"; PPRO="$(get PRICE_PRO_MONTHLY)"; PELI="$(get PRICE_ELITE_MONTHLY)"; PIP="$(get PRICE_ID_PRO)"; PIE="$(get PRICE_ID_ELITE)"

echo "Readiness (local .env.local):"
printf "  BASE_URL:             %s %s\n" "$(ok "$BASE_URL")" "${BASE_URL:-}"
printf "  ADMIN_TOKEN:          %s\n" "$(ok "$ADMIN_TOKEN_SET")"
printf "  Telegram: token=%s  PRO=%s  ELITE=%s\n"  "$(ok "$TG_TOKEN")" "$(ok "$TG_PRO")" "$(ok "$TG_ELITE")"
printf "  Discord (FREE webhook): %s\n" "$(ok "$DC_FREE")"
printf "  X keys: API=%s Secret=%s Access=%s AccessSecret=%s\n" "$(ok "$XK")" "$(ok "$XS")" "$(ok "$XT")" "$(ok "$XTS")"
printf "  Stripe: key=%s webhook=%s price(pro)=%s price(elite)=%s\n"  "$(ok "$SP")" "$(ok "$SWH")" "$(ok "${PPRO:-$PIP}")" "$(ok "${PELI:-$PIE}")"

echo
echo "If any ❌:"
echo "  • Telegram: run  make tiers-telegram"
echo "  • Discord:  set DISCORD_WEBHOOK_URL_FREE in .env.local + Render, then  make discord"
echo "  • X keys:   set X_* in .env.local + Render, then  make x"
echo "  • Stripe:   ensure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and PRICE_ID_* or PRICE_*_MONTHLY set in Render"
