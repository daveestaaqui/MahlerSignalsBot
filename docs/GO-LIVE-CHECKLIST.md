# Go-Live Checklist – ManySignals

✅ **DNS + TLS**
- `manysignals.finance` → marketing host with HTTPS.
- `aurora-signals.onrender.com` (or your Render Web Service) → production API with HTTPS enforced.

✅ **Render environment**
- `BASE_URL=https://aurora-signals.onrender.com` (see `docs/RENDER_ENV.md` for the full matrix).
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`, `STRIPE_SUCCESS_URL=https://manysignals.finance/checkout/success`, `STRIPE_CANCEL_URL=https://manysignals.finance/checkout/cancel`, `STRIPE_WEBHOOK_SECRET`.
- Data providers: `EQUITY_API_KEY` (Polygon), optional `CRYPTO_API_KEY` (CoinGecko Pro), `EQUITY_API_BASE_URL`/`CRYPTO_API_BASE_URL` if overriding.
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_FREE`, `TELEGRAM_CHAT_ID_PRO`, `TELEGRAM_CHAT_ID_ELITE`.
- Discord: `DISCORD_WEBHOOK_URL`.
- Marketing channels: `MARKETING_TELEGRAM_CHAT_ID`, `MARKETING_DISCORD_WEBHOOK_URL`, promo flags (`PROMO_ENABLED`, `MARKETING_DRY_RUN`).

✅ **Automation secrets**
- GitHub `BASE_URL` secret updated to `https://aurora-signals.onrender.com`.
- Health workflows (`AURORA-health-monitor.yml`, `daily-health.yml`, etc.) share the same base URL and admin token.

✅ **Stripe webhook**
- Dashboard → Developers → Webhooks → add `https://aurora-signals.onrender.com/stripe/webhook` and paste the secret into Render.

✅ **Operational checks**
- `pnpm build` succeeds locally.
- `/status`, `/healthz`, `/metrics`, `/metrics/weekly`, `/diagnostics`, `/signals/today`, `/marketing/preview`, `/about`, `/legal`, `/stripe/checkout` respond 200 via the production base (`scripts/check-prod.sh` is the quick sweep).
- `/admin/test-all` (with `Authorization: Bearer ADMIN_TOKEN`) reports success for signals + Discord + Telegram. Investigate any missing secrets before launch.
- Marketing workflows (daily + weekly) run in dry mode and log “channel not configured” when secrets are blank—no failing jobs due to absent channels.
- `sendMarketingPosts` dry-run preview logged via `pnpm tsx -e "import('./src/services/marketing').then(m=>m.sendMarketingPosts(new Date(),{dryRun:true}))"` or by calling the admin endpoints.
- Hostinger preview sections confirm the `/marketing/preview` payload and CORS headers.

Reminder: Plans stay Free / $14 / $39 and no signal is guaranteed. If upstream data is missing, return an empty list rather than fabricating numbers.
