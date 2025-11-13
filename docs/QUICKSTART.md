# ManySignals Quickstart

Bring the Aurora-Signals backend (API) and ManySignals marketing surface online. Canonical endpoints:
- API base: https://aurora-signals.onrender.com
- Marketing site: https://manysignals.finance

## 1. Prerequisites
- Node.js 20.x and pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`).
- Real provider keys: Polygon (`EQUITY_API_KEY`) and optional CoinGecko Pro (`CRYPTO_API_KEY`).
- Stripe account with active `STRIPE_PRICE_PRO` ($14) and `STRIPE_PRICE_ELITE` ($39) IDs + webhook secret.
- Optional broadcast secrets: Telegram bot token/chat IDs, Discord webhook, X credentials.

## 2. Configure environment

```bash
cp .env.example .env.local
cat >> .env.local <<'EOF_ENV'
BASE_URL=https://aurora-signals.onrender.com
STRIPE_SUCCESS_URL=https://manysignals.finance/checkout/success
STRIPE_CANCEL_URL=https://manysignals.finance/checkout/cancel
EQUITY_API_KEY=pk_live_polygon
CRYPTO_API_KEY=optional_coin_gecko
EOF_ENV
```

Never fake market data. If providers fail, the API should return an empty list or an error—not fabricated prices.

## 3. Install + run locally

```bash
pnpm install
pnpm build
pnpm dev   # boots Express on http://localhost:3000
```

The static marketing bundle points at the production API. Override via `<html data-api-base>` or by setting `window.__MANY_SIGNALS_API__` for local testing.

## 4. Deploy on Render
1. Create a Render Web Service from this repo (Node 20). Build command `pnpm install && pnpm build`. Start command `pnpm start`.
2. Add env vars: `ADMIN_TOKEN`, `BASE_URL=https://aurora-signals.onrender.com`, Polygon/CoinGecko keys, Stripe keys, Telegram/Discord secrets.
3. Redeploy and verify `/status`, `/healthz`, `/metrics`, `/metrics/weekly`, `/diagnostics`, `/signals/today`, `/about`, and `/legal` all succeed via the production base.
4. Serve the marketing site at `https://manysignals.finance` (or temporarily from `/public` inside this repo) and ensure CORS remains limited to the marketing origins.

## 5. Smoke tests

```bash
BASE_URL=https://aurora-signals.onrender.com ADMIN_TOKEN=secret ./scripts/verify-suite.sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://aurora-signals.onrender.com/admin/test-all | jq .
```

`/admin/test-all` confirms signal fetch plus Telegram/Discord connectivity for the Free / $14 / $39 tiers.
