#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL env required}"
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

curl_check() {
  local method="$1"
  local path="$2"
  shift 2

  local root_url="${root_base}${path}"
  local api_url="${api_base}${path}"

  if [[ "${method}" == "GET" ]]; then
    curl -fsS "${root_url}" "$@" >/dev/null || curl -fsS "${api_url}" "$@" >/dev/null
  else
    curl -fsS -X "${method}" "${root_url}" "$@" >/dev/null || curl -fsS -X "${method}" "${api_url}" "$@" >/dev/null
  fi
}

curl_check GET "/status"
curl_check GET "/diagnostics"
curl_check GET "/weekly-summary"
curl_check POST "/admin/post-now" -H "Authorization: Bearer ${ADMIN_TOKEN}"

echo "smoke checks passed"
