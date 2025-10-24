#!/usr/bin/env bash
set -euo pipefail
node - <<'JS'
import { postX } from './dist/services/posters_x.js';
const ok = await postX("Hello from AuroraSignalX (test)");
console.log(ok ? "✅ X ok" : "❌ X failed");
JS
