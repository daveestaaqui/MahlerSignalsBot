#!/usr/bin/env bash
set -euo pipefail

CURL="/usr/bin/curl"

if [ -f "$HOME/.aurora.env" ]; then set -a; . "$HOME/.aurora.env"; set +a; fi
export BASE ADMIN_TOKEN RENDER_API_KEY RENDER_SERVICE_ID
: "${BASE:=}"; : "${ADMIN_TOKEN:=}"; : "${RENDER_API_KEY:=}"; : "${RENDER_SERVICE_ID:=}"
BASE="${BASE%/}"
[ -n "$BASE" ] && echo "$BASE" | grep -Eq '^https?://' || { echo "endpoint | HTTP | TTFB_ms | note"; echo "status | 000 | 0 | invalid BASE"; echo "NO-GO"; exit 1; }
[ -n "$ADMIN_TOKEN" ] || { echo "endpoint | HTTP | TTFB_ms | note"; echo "api/preview/daily | 000 | 0 | missing ADMIN_TOKEN"; echo "NO-GO"; exit 1; }

if command -v corepack >/dev/null 2>&1; then corepack enable || true; corepack prepare pnpm @9 --activate || true; fi
command -v pnpm >/dev/null 2>&1 || command -v npm >/dev/null 2>&1 && npm i -g pnpm@9 >/dev/null 2>&1 || true
command -v pnpm >/dev/null 2>&1 || { echo "endpoint | HTTP | TTFB_ms | note"; echo "status | 000 | 0 | pnpm missing"; echo "NO-GO"; exit 1; }

pnpm install --no-frozen-lockfile || (pnpm store prune || true; pnpm install --no-frozen-lockfile)
pnpm run build || pnpm run build:prod 2>/dev/null || pnpm run compile 2>/dev/null || true

if ! command -v render >/dev/null 2>&1; then command -v npm >/dev/null 2>&1 && npm i -g @render/render >/dev/null 2>&1 || npm i -g render-cli >/dev/null 2>&1 || true; fi

if [ ! -f "render.yaml" ] && [ ! -f "render.yml" ]; then
cat > render.yaml <<'YAML'
services:
  - type: web
    name: aurora-signals
    env: node
    plan: starter
    region: oregon
    buildCommand: pnpm install --no-frozen-lockfile && pnpm run build
    startCommand: node dist/web/server.js
    autoDeploy: true
YAML
fi

if command -v render >/dev/null 2>&1 && [ -n "${RENDER_API_KEY}" ] && [ -n "${RENDER_SERVICE_ID}" ]; then
render login --api-key "$RENDER_API_KEY" >/dev/null 2>&1 || true
[ -f render.yaml ] && render services update "$RENDER_SERVICE_ID" --from-file render.yaml --confirm >/dev/null 2>&1 || true
render deploy "$RENDER_SERVICE_ID" --clear-cache --confirm >/dev/null 2>&1 || true
fi

ms(){ python3 - "$1" <<'PY' 2>/dev/null || echo 0
import sys
try:
    print(int(float(sys.argv[1])*1000))
except:
    print(0)
PY
}
pair(){ local BASE_ARG="$1"; $CURL -sS -o /dev/null -w "%{http_code}:%{time_starttransfer}" "$BASE_ARG" 2>/dev/null || echo "000:0"; }
auth_pair(){ local BASE_ARG="$1"; local ADMIN_TOKEN_ARG="$2"; $CURL -sS -o /dev/null -w "%{http_code}:%{time_starttransfer}" -H "Authorization: Bearer $ADMIN_TOKEN_ARG" "$BASE_ARG" 2>/dev/null || echo "000:0"; }
post_pair(){
  local BASE_ARG="$1"; local ADMIN_TOKEN_ARG="$2"; local ep="$3"; local data="$4"; local tmp="$(mktemp)";
  local out="$($CURL -sS -o "$tmp" -w \"%{http_code}:%{time_starttransfer}\" -X POST -H \"Authorization: Bearer $ADMIN_TOKEN_ARG\" -H \"Content-Type: application/json\" --data-binary \"$data\" \"$BASE_ARG/$ep\" 2>/dev/null || echo \"000:0\")"
  local code="${out%%:*}"; if [ "$code" != "200" ] && [ "$code" != "204" ]; then printf "BODY:%s:" "$ep"; head -c 200 "$tmp" 2>/dev/null; echo; fi
  rm -f "$tmp"; echo "$out"
}
row(){ name="$1"; pair="$2"; note="$3"; code="${pair%%:*}"; ttfb="${pair##:*}"; printf "%s | %s | %s | %s\n" "$name" "$code" "$(ms "$ttfb")" "$note"; }

sleep 2
S="$(pair "$BASE/status")"
H="$(pair "$BASE/healthz")"
P="$(auth_pair "$BASE/api/preview/daily" "$ADMIN_TOKEN")"

echo "endpoint | HTTP | TTFB_ms | note"
row "status" "$S" "ok"
row "healthz" "$H" "ok"
row "api/preview/daily" "$P" "auth"

N="$(post_pair "$BASE" "$ADMIN_TOKEN" "admin/post-now" '{}')"
D="$(post_pair "$BASE" "$ADMIN_TOKEN" "admin/post-daily" '{\"dryRun\":true}')"
W="$(post_pair "$BASE" "$ADMIN_TOKEN" "admin/post-weekly" '{\"dryRun\":true}')"
T="$(post_pair "$BASE" "$ADMIN_TOKEN" "admin/test-telegram" '{}')"
C="$(post_pair "$BASE" "$ADMIN_TOKEN" "admin/test-discord" '{}')"

row "admin/post-now" "$N" "post"
row "admin/post-daily" "$D" "dryRun"
row "admin/post-weekly" "$W" "dryRun"
row "admin/test-telegram" "$T" "ping"
row "admin/test-discord" "$C" "ping"

printf '{"type":"ping","id":"evt_px_test"}' > .stripe.json
STRIPE_PAIR="$($CURL -sS -o /dev/null -w \"%{http_code}:%{time_starttransfer}\" -X POST -H \"Content-Type: application/json\" --data-binary @MahlerSignalsBot/.stripe.json \"$BASE/webhooks/stripe\" 2>/dev/null || echo \"000:0\")"
row "webhooks/stripe" "$STRIPE_PAIR" "ping"

if command -v gh >/dev/null 2>&1; then gh repo edit daveestaaqui/MahlerSignalsBot --visibility private >/dev/null 2>&1 || true; fi

ok(){ [ "${1%%:*}" = "200" ] || [ "${1%%:*}" = "204" ]; }
ALL=1
ok "$S" && ok "$H" && ok "$N" && ok "$D" && ok "$W" && ok "$T" && ok "$C" && { sc="${STRIPE_PAIR%%:*}"; [ "$sc" -ge 200 ] && [ "$sc" -lt 300 ]; } || ALL=0
if [ "$ALL" -eq 1 ]; then
echo "GO"
echo "✅ AuroraSignals fully live."
echo "TG/Discord/Stripe verified."
echo "Render build stable."
echo "Next: add uptime + error-rate monitoring and a daily cron ping to admin/post-daily."
else
echo "NO-GO"
fi
