#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL env required}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN env required}"

call() {
  local method="$1"
  local path="$2"
  shift 2 || true
  local url="${BASE_URL}${path}"
  local response status body
  response=$(curl -sS -w '\n%{http_code}' -X "$method" "$url" "$@" || true)
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  printf '%s %s -> %s %s\n' "$method" "$path" "$status" "$(echo "$body" | jq -c '{ok,reason,posted,error,preview}' 2>/dev/null || echo "$body")"
}

auth_header=("-H" "Authorization: Bearer ${ADMIN_TOKEN}")

call GET "/status"
call GET "/diagnostics"
call GET "/preview/daily"
call GET "/weekly-summary"
call POST "/admin/post-now" "${auth_header[@]}"
call POST "/admin/post-daily" "${auth_header[@]}"
