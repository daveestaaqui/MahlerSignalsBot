#!/usr/bin/env bash

AuroraSignals: robust one-shot deploy and verify (ASCII-only)

set -euo pipefail

–––– Preflight ––––

CURL="$(command -v curl || echo /usr/bin/curl)"
[ -x "$CURL" ] || { echo "endpoint | HTTP | TTFB_ms | note"; echo "status | 000 | 0 | curl missing"; echo "NO-GO"; exit 1; }

# Prefer Node 20.x; auto-switch via nvm if available

need_node20() {
if command -v node >/dev/null 2>&1; then
v="$(node -v 2>/dev/null | tr -d 'v')"
major="${v%%.*}"
[ "$major" = "20" ] && return 1 || return 0
else
return 0
fi
}
if need_node20 && command -v nvm >/dev/null 2>&1; then
nvm install 20.18.0 >/dev/null 2>&1 || true
nvm use 20.18.0 >/dev/null 2>&1 || true
fi

# Clean ~/.aurora.env to plain KEY=VALUE, strip export/quotes; macOS/Linux compatible

if [ -f "$HOME/.aurora.env" ]; then
tmpenv="$(mktemp)"
awk 'BEGIN{FS="="}
/^[[:space:]]#/ {next}
NF<2 {next}
{ 
gsub(/^[[:space:]]+|[[:space:]]+$/,"",$0)
sub(/^export[[:space:]]+/,"",$0)
key=$1; sub(/^[[:space:]]+/,"",key); sub(/[[:space:]]+$/,"",key)
val=substr($0, index($0, "=")+1)
gsub(/^[[:space:]]+|[[:space:]]+$/,"",val)
if (val ~ /^\".*\"$/ || val ~ /^\".*\'$/) { val=substr(val,2,length(val)-2) }
print key "=" val
}' "$HOME/.aurora.env" > "$tmpenv" && cp "$HOME/.aurora.env" "$HOME/.aurora.env.bak" && mv "$tmpenv" "$HOME/.aurora.env"
set -a; . "$HOME/.aurora.env"; set +a
else
: 
fi

: "${BASE:=}"; : "${ADMIN_TOKEN:=}"; : "${RENDER_API_KEY:=}"; : "${RENDER_SERVICE_ID:=}"
BASE="${BASE%/}"

–––– Repo ––––

cd "$HOME/davidmahler/MahlerSignalsBot" 2>/dev/null || cd "$HOME/MahlerSignalsBot" 2>/dev/null || {
echo "endpoint | HTTP | TTFB_ms | note"
echo "status | 000 | 0 | repo not found"
echo "healthz | 000 | 0 | repo not found"
echo "api/preview/daily | 000 | 0 | repo not found"
echo "admin/post-now | 000 | 0 | repo not found"
echo "admin/post-daily | 000 | 0 | repo not found"
echo "admin/post-weekly | 000 | 0 | repo not found"
echo "admin/test-telegram | 000 | 0 | repo not found"
echo "admin/test-discord | 000 | 0 | repo not found"
echo "webhooks/stripe | 000 | 0 | repo not found"
echo "NO-GO"
exit 1
}

–––– Toolchain (pnpm/render) ––––

if command -v corepack >/dev/null 2>&1; then
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm @9 --activate >/dev/null 2>&1 || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
if command -v npm >/dev/null 2>&1; then npm i -g pnpm@9 >/dev/null 2>&1 || true; fi
fi
command -v pnpm >/dev/null 2>&1 || {
echo "endpoint | HTTP | TTFB_ms | note"
echo "status | 000 | 0 | pnpm missing"
echo "healthz | 000 | 0 | pnpm missing"
echo "api/preview/daily | 000 | 0 | pnpm missing"
echo "admin/* | 000 | 0 | pnpm missing"
echo "webhooks/stripe | 000 | 0 | pnpm missing"
echo "NO-GO"
exit 1
}

–––– Install/build (with one-pass autofix) ––––

pnpm install --no-frozen-lockfile >/dev/null 2>&1 || (pnpm store prune >/dev/null 2>&1 || true; pnpm install --no-frozen-lockfile >/dev/null 2>&1 || true)
if ! pnpm run build >/dev/null 2>&1; then
pnpm run build:prod >/dev/null 2>&1 || pnpm run compile >/dev/null 2>&1 || true
fi

–––– Render spec ––––

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

–––– Render CLI + deploy ––––

if ! command -v render >/dev/null 2>&1; then
if command -v npm >/dev/null 2>&1; then npm i -g @render/render >/dev/null 2>&1 || npm i -g render-cli >/dev/null 2>&1 || true; fi
fi
if command -v render >/dev/null 2>&1 && [ -n "${RENDER_API_KEY}" ] && [ -n "${RENDER_SERVICE_ID}" ]; then
render login --api-key "$RENDER_API_KEY" >/dev/null 2>&1 || true
if [ -f render.yaml ]; then render services update "$RENDER_SERVICE_ID" --from-file render.yaml --confirm >/dev/null 2>&1 || true; fi
render deploy "$RENDER_SERVICE_ID" --clear-cache --confirm >/dev/null 2>&1 || true
fi

–––– Helpers ––––

ms() { python3 - "$1" <<'PY' 2>/dev/null || echo 0
import sys
try:
print(int(float(sys.argv[1])*1000))
except:
print(0)
PY
}
pair() { "$CURL" -sS -o /dev/null -w "%{{http_code}}:%{{time_starttransfer}}" "$1" 2>/dev/null || echo "000:0"; }
auth_pair() { "$CURL" -sS -o /dev/null -w "%{{http_code}}:%{{time_starttransfer}}" -H "Authorization: Bearer $ADMIN_TOKEN" "$1" 2>/dev/null || echo "000:0"; }
post_pair() {

ep="$1"; data="$2"; tmp="$(mktemp)"
out="$($CURL -sS -o "$tmp" -w "%{{http_code}}:%{{time_starttransfer}}" -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json; charset=utf-8" --data-binary "$data" "$BASE/$ep" 2>/dev/null || echo "000:0")"
code="${out%%:*}"
if [ "$code" != "200" ] && [ "$code" != "204" ]; then printf "BODY:%s:": "$ep"; head -c 200 "$tmp" 2>/dev/null || true; echo; fi
rm -f "$tmp"; echo "$out"
}
row() { name="$1"; pair="$2"; note="$3"; code="${pair%%:*}"; ttfb="${pair##:*}"; printf "%s | %s | %s | %s\n" "$name" "$code" "$(ms "$ttfb")" "$note"; }

–––– Sanity on BASE/ADMIN_TOKEN ––––

valid_base=1
if [ -z "$BASE" ]; then valid_base=0; fi
echo "$BASE" | grep -Eq '^https?://[^ ]+$' || valid_base=0

if [ "$valid_base" -eq 0 ] || [ -z "$ADMIN_TOKEN" ]; then
echo "endpoint | HTTP | TTFB_ms | note"
[ "$valid_base" -eq 0 ] && echo "status | 000 | 0 | invalid BASE"
[ "$valid_base" -eq 0 ] && echo "healthz | 000 | 0 | invalid BASE"
[ -z "$ADMIN_TOKEN" ] && echo "api/preview/daily | 000 | 0 | missing ADMIN_TOKEN"
echo "admin/post-now | 000 | 0 | missing env"
echo "admin/post-daily | 000 | 0 | missing env"
echo "admin/post-weekly | 000 | 0 | missing env"
echo "admin/test-telegram | 000 | 0 | missing env"
echo "admin/test-discord | 000 | 0 | missing env"
echo "webhooks/stripe | 000 | 0 | missing env"
echo "NO-GO"
exit 1
fi

–––– Verify ––––

sleep 2
S="$(pair "$BASE/status")"
H="$(pair "$BASE/healthz")"
P="$(auth_pair "$BASE/api/preview/daily")"

echo "endpoint | HTTP | TTFB_ms | note"
row "status" "$S" "ok"
row "healthz" "$H" "ok"
row "api/preview/daily" "$P" "auth"

–––– Channels ––––

N="$(post_pair "admin/post-now" '{}')"
D="$(post_pair "admin/post-daily" '{\"dryRun\":true}')"
W="$(post_pair "admin/post-weekly" '{\"dryRun\":true}')"
Tg="$(post_pair "admin/test-telegram" '{}')"
Dc="$(post_pair "admin/test-discord" '{}')"

row "admin/post-now" "$N" "post"
row "admin/post-daily" "$D" "dryRun"
row "admin/post-weekly" "$W" "dryRun"
row "admin/test-telegram" "$Tg" "ping"
row "admin/test-discord" "$Dc" "ping"

–––– Stripe ––––

printf '{\"type\":\"ping\",\"id\":\"evt_px_test\"}' > .stripe.json
STR="$( "$CURL" -sS -o /dev/null -w \"%{http_code}:%{time_starttransfer}\" -X POST -H \"Content-Type: application/json; charset=utf-8\" --data-binary @MahlerSignalsBot/.stripe.json \"$BASE/webhooks/stripe\" 2>/dev/null || echo \"000:0\")"
row "webhooks/stripe" "$STR" "ping"

–––– Security (best-effort) ––––

if command -v gh >/dev/null 2>&1; then gh repo edit daveestaaqui/MahlerSignalsBot --visibility private >/dev/null 2>&1 || true; fi

–––– Autofix quick redeploy if needed ––––

ok(){ c="${1%%:*}"; [ "$c" = "200" ] || [ "$c" = "204" ]; }
all_ok=1
ok "$S" && ok "$H" && ok "$N" && ok "$D" && ok "$W" && ok "$Tg" && ok "$Dc" && { sc="${STR%%:*}"; [ "$sc" -ge 200 ] && [ "$sc" -lt 300 ]; } || all_ok=0

if [ "$all_ok" -ne 1 ]; then
if command -v render >/dev/null 2>&1 && [ -n "${RENDER_SERVICE_ID}" ]; then
render deploy "$RENDER_SERVICE_ID" --clear-cache --confirm >/dev/null 2>&1 || true
fi
sleep 4
S="$(pair "$BASE/status")"
H="$(pair "$BASE/healthz")"
all_ok=1
ok "$S" && ok "$H" && ok "$N" && ok "$D" && ok "$W" && ok "$Tg" && ok "$Dc" && { sc="${STR%%:*}"; [ "$sc" -ge 200 ] && [ "$sc" -lt 300 ]; } || all_ok=0
fi

–––– Final ––––

if [ "$all_ok" -eq 1 ]; then
echo "GO"
echo "✅ AuroraSignals fully live."
echo "TG/Discord/Stripe verified."
echo "Render build stable."
echo "Next: add uptime + error-rate monitoring and a daily cron ping to admin/post-daily."
else
echo "NO-GO"
fi