# Go-Live Checklist – ManySignals

✅ **DNS + TLS**
- `manysignals.finance` -> marketing host with HTTPS.
- `api.manysignals.finance` -> Render Web Service (CNAME/ALIAS) with HTTPS enforced.

✅ **Render environment**
- `BASE_URL=https://api.manysignals.finance`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`, `STRIPE_SUCCESS_URL=https://manysignals.finance/checkout/success`, `STRIPE_CANCEL_URL=https://manysignals.finance/checkout/cancel`.
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_FREE`, `TELEGRAM_CHAT_ID_PRO`, `TELEGRAM_CHAT_ID_ELITE`.
- Discord: `DISCORD_WEBHOOK_URL`.

✅ **Stripe webhook**
- Dashboard → Developers → Webhooks → add `https://api.manysignals.finance/stripe/webhook` and paste the secret into Render (`STRIPE_WEBHOOK_SECRET`).

✅ **Automation secrets**
- GitHub `BASE_URL` secret updated to `https://api.manysignals.finance` (marketing + health workflows).
- `.github/workflows/AURORA-health-monitor.yml` sees valid `BASE_URL`, `RENDER_API_KEY`, `RENDER_SERVICE_ID`.

✅ **Operational checks**
- `pnpm build` succeeds locally.
- `/status`, `/healthz`, `/signals/today`, `/checkout/success`, `/checkout/cancel` return `200` via the production Base URL.
- `/admin/test-all` (with `ADMIN_TOKEN`) reports success for signals + Discord + Telegram; investigate any missing secrets before launch.
