#!/usr/bin/env bash
set -euo pipefail
if ! command -v stripe >/dev/null 2>&1; then
  echo "Install Stripe CLI: https://stripe.com/docs/stripe-cli"
  exit 1
fi
echo "Examples:"
echo "  stripe login"
echo "  stripe listen --forward-to localhost:8787/webhook/stripe"
echo "  stripe trigger checkout.session.completed"
