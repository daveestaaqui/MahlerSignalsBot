#!/usr/bin/env bash
set -euo pipefail
source ./.env.local 2>/dev/null || true
: "${X_API_KEY:?Set X_API_KEY in .env.local}"
: "${X_API_SECRET:?Set X_API_SECRET in .env.local}"
: "${X_ACCESS_TOKEN:?Set X_ACCESS_TOKEN in .env.local}"
: "${X_ACCESS_TOKEN_SECRET:?Set X_ACCESS_TOKEN_SECRET in .env.local}"
node --input-type=module <<'JS'
import { postX } from './dist/services/posters_x.js';
const ok = await postX('Hello from AuroraSignals (test)');
console.log(ok ? '✅ X ok' : '❌ X failed');
JS
