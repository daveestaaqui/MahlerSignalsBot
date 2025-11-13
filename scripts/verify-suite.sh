#!/usr/bin/env bash
set -euo pipefail
BASE_URL="$(grep -E '^BASE_URL=' .env.local | tail -1 | cut -d= -f2-)"
[ -z "$BASE_URL" ] && BASE_URL="https://aurora-signals.onrender.com"

echo "• setup:"
curl -s "$BASE_URL/setup" | head || true

echo "• status:"
curl -s "$BASE_URL/status" | head || true

echo "• stripe pro:"
curl -s "$BASE_URL/stripe/create-session?tier=pro" | head -c 200 || true
echo

echo "• stripe elite:"
curl -s "$BASE_URL/stripe/create-session?tier=elite" | head -c 200 || true
echo

echo "• tg-pro:"
make tg-pro || true

echo "• tg-elite:"
make tg-elite || true
