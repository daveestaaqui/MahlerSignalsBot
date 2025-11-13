# ManySignals Quickstart

Bring the Render backend and marketing surface online with the production defaults (`https://manysignals.finance` for the marketing entry point and `https://api.manysignals.finance` for the API).

## 1. Prerequisites
- Node.js 20.x and pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`).
- Stripe account with active `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ELITE` IDs.
- Render Web Service ready to host the API.
- Telegram + Discord credentials (optional, but required for `/admin/test-all`).

## 2. Configure environment
```bash
cp .env.example .env.local
cat >> .env.local <<'EOF'
BASE_URL=https://api.manysignals.finance
STRIPE_SUCCESS_URL=https://manysignals.finance/checkout/success
STRIPE_CANCEL_URL=https://manysignals.finance/checkout/cancel
EOF
```
Add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_FREE`, `TELEGRAM_CHAT_ID_PRO`, `TELEGRAM_CHAT_ID_ELITE`, and `DISCORD_WEBHOOK_URL` either to `.env.local` or directly inside the Render dashboard.

## 3. Install + build locally
```bash
pnpm install
pnpm build
pnpm dev
```
The static marketing bundle calls `API_BASE = https://api.manysignals.finance`; override it locally via the `<html data-api-base>` attribute in `public/index.html` or by setting `window.__MANY_SIGNALS_API__ = 'http://localhost:3000'` in devtools.

## 4. Deploy on Render
1. Create a Render Web Service from this repo (Node 20, build command `pnpm install && pnpm build`, start command `pnpm start`).
2. Set `BASE_URL=https://api.manysignals.finance` plus all Stripe/Telegram/Discord secrets.
3. Redeploy and verify `https://api.manysignals.finance/status`, `/healthz`, and `/signals/today` return 200.
4. Serve the marketing site at `https://manysignals.finance` (static host or Render static site) while leaving `/public` available here for SEO fallbacks.

## 5. Smoke tests
```bash
BASE_URL=https://api.manysignals.finance ADMIN_TOKEN=... ./scripts/verify-admin.sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.manysignals.finance/admin/test-all | jq .
```
`/admin/test-all` confirms signal fetch plus Discord/Telegram connectivity end-to-end.
