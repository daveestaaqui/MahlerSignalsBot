#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-chore: redeploy}"
HOOK="${RENDER_DEPLOY_HOOK:-${RENDER_HOOK_URL:-}}"

if [ -z "$HOOK" ]; then
  echo "❌ Set RENDER_DEPLOY_HOOK (or RENDER_HOOK_URL) before running redeploy.sh" >&2
  exit 1
fi

echo "▶️  Building workspace"
pnpm install >/dev/null
pnpm build
pnpm test

git status -sb
git add -A

if git diff --cached --quiet; then
  echo "ℹ️  No staged changes detected; skipping commit/push."
else
  git commit -m "$MSG"
  git push
fi

echo "🚀 Triggering Render deploy hook"
curl -fsS -X POST "$HOOK" >/dev/null
echo "Done."
