#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://aurora-signals.onrender.com}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN env required}"

trimmed_base="${BASE_URL%/}"
if [[ "${trimmed_base##*/}" == "api" ]]; then
  root_base="${trimmed_base%/api}"
  api_base="${trimmed_base}"
else
  root_base="${trimmed_base}"
  api_base="${trimmed_base}/api"
fi

root_base="${root_base%/}"
api_base="${api_base%/}"

curl_with_fallback() {
  local method="$1"
  local path="$2"
  shift 2

  local root_url="${root_base}${path}"
  local api_url="${api_base}${path}"

  if [[ "$method" == "GET" ]]; then
    if curl -sSf "$root_url" "$@" >/dev/null; then
      return 0
    fi
    curl -sSf "$api_url" "$@" >/dev/null
  else
    if curl -sSf -X "$method" "$root_url" "$@" >/dev/null; then
      return 0
    fi
    curl -sSf -X "$method" "$api_url" "$@" >/dev/null
  fi
}

curl_with_fallback GET "/status"
curl_with_fallback GET "/diagnostics"
curl_with_fallback GET "/weekly-summary"

auth_header=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
curl_with_fallback POST "/admin/post-daily" "${auth_header[@]}"
curl_with_fallback POST "/admin/post-weekly" "${auth_header[@]}"
curl_with_fallback POST "/admin/post-now" "${auth_header[@]}"

echo "verification succeeded"
