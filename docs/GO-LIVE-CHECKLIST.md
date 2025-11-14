# GO-LIVE CHECKLIST — ManySignals Finance

## Before going live
- [ ] All Render env vars match [`docs/RENDER_ENV.md`](./RENDER_ENV.md); double-check `BASE_URL`, `ADMIN_TOKEN`, Polygon/CoinGecko keys, and all marketing channel secrets.
- [ ] Stripe dashboard has live `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, success/cancel URLs, and the webhook pointing to `https://aurora-signals.onrender.com/stripe/webhook`.
- [ ] GitHub Actions secrets (`TELEGRAM_BOT_TOKEN`, `*_CHAT_ID`, `MARKETING_DISCORD_WEBHOOK_URL`, `X_BEARER_TOKEN`, `MARKETING_DRY_RUN`) are populated so marketing workflows can fan out without edits to the YAML.
- [ ] `MARKETING_DRY_RUN` is `"true"` everywhere (Render + GitHub). Trigger `/admin/post-now?dryRun=true` or run `pnpm tsx -e "import('./src/services/marketing').then(m => m.sendMarketingPosts(new Date(), { dryRun: true }))"` to review copy. Flip to `"false"` only after reviewing the preview logs.
- [ ] Run `scripts/check-prod.sh` (uses `BASE_URL`). Confirm `/status`, `/healthz`, `/signals/today`, `/marketing/preview`, and `/diagnostics` all return `200` from Render.

## Operational confirmations
- [ ] `/admin/test-all` (Bearer `ADMIN_TOKEN`) shows `{ ok: true }` and `checks.signalsToday` / `checks.marketingPreview` both `ok: true` with non-zero counts.
- [ ] Hostinger sections render correctly after pulling `/marketing/preview` and `/signals/today` with CORS headers (`https://manysignals.finance` + `www` are whitelisted).
- [ ] `pnpm build && pnpm test` are clean locally before deploying.
- [ ] `marketing-daily` and `marketing-weekly` workflows succeed in dry-run mode on GitHub; logs should mention `marketing-daily complete` / `marketing-weekly complete`.
- [ ] Render deploy hook is documented in `scripts/redeploy.sh` and verified once prior to launch.

### Command quick reference
```bash
# 1) Diagnostics sweep with ADMIN_TOKEN
curl -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  https://aurora-signals.onrender.com/admin/test-all | jq

# 2) Dry-run the daily marketing post
curl -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -X POST "https://aurora-signals.onrender.com/admin/post-daily?dryRun=true"

# 3) Mimic Hostinger fetching /marketing/preview (Origin header enabled)
curl -H "Origin: https://manysignals.finance" \
  https://aurora-signals.onrender.com/marketing/preview | jq
```

Keep launch messaging scenario-based: call the public product “ManySignals Finance” and refer to the Aurora Signals engine only as the backend analysis stack. Never fabricate data—if upstream sources are empty, return empty arrays with `ok: false`.
