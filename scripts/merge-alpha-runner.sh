#!/usr/bin/env bash
set -euo pipefail
A="src/pipeline/stocks/alphaRunner.ts"
B="src/pipeline/stocks/alphaRunner.safe.ts"
if [ ! -f "$B" ]; then echo "No safe runner to merge."; exit 0; fi
echo "=== Diff (current vs safe) ==="
diff -u "$A" "$B" || true
echo
echo "To adopt, review and then run:"
echo "  cp $B $A && git add $A && git commit -m 'merge: adopt safe alpha runner'"
