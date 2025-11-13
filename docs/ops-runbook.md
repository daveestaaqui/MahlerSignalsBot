# ManySignals Ops Runbook

## Canonical endpoints
- API: https://aurora-signals.onrender.com
- Marketing: https://manysignals.finance
- Public JSON: `/status`, `/healthz`, `/metrics`, `/metrics/weekly`, `/diagnostics`, `/signals/today`, `/marketing/preview`, `/about`, `/blog`, `/blog/:slug`, `/legal`

## Daily routine
1. Keep the Render service on Node 20 with `pnpm start` (serves Express + schedulers).
2. Monitor `/status` (heartbeat) and `/signals/today` (should return an array; empty arrays mean upstream data issues, not fake data).
3. Marketing workflows (daily + weekly) consume `BASE_URL` which defaults to the canonical API and skip Telegram/Discord when secrets are unset.

## Manual commands
```bash
pnpm build
pnpm start
curl https://aurora-signals.onrender.com/status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  -X POST https://aurora-signals.onrender.com/admin/post-now
```

## Environment variables
- `ADMIN_TOKEN`: bearer token for `/admin/*` routes.
- Polygon & CoinGecko keys: required for live signals; never substitute mock data.
- Stripe keys: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO` ($14), `STRIPE_PRICE_ELITE` ($39), URLs, and webhook secret.
- Optional: Telegram bot token/chat IDs, Discord webhook, X credentials.

## Incident response
- **Empty signals**: check provider logs (`signals.equity.fetch_failed`, `signals.build.reject`). If providers are down, respond with empty arrays and communicate status—do not fabricate data.
- **Checkout failures**: confirm Stripe env vars and the canonical success/cancel URLs pointing to `manysignals.finance`.
- **CORS complaints**: only `https://manysignals.finance` and `https://www.manysignals.finance` are allowed origins. Ensure the frontend uses the canonical API base.

## Legal
All surfaces must display the short disclaimer from `src/lib/legal.ts`. `/about`, `/legal`, `/signals/today`, marketing templates, and the public UI already pull from this source—reuse it for any new surface.
