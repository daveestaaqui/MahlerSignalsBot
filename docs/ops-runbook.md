# ManySignals Ops Runbook

## Deploy & release
- CI builds, but Render still deploys on `git push origin main`. Use `scripts/redeploy.sh` to trigger the Render deploy hook with the right service ID when you need an out-of-band redeploy.
- Local smoke test before pushing:
  ```bash
  nvm use 20
  pnpm install
  pnpm build && pnpm test
  ```
- Render service runs `pnpm start` on Node 20. If it wedges, redeploy or restart via Render dashboard.

## Admin & marketing endpoints
- `GET /admin/test-all` (Bearer `ADMIN_TOKEN`) → `{ ok, baseUrl, checks }`. `checks.signalsToday.ok` and `checks.marketingPreview.ok` should be `true`; channel checks report whether Telegram/Discord/X secrets exist.
- `POST /admin/post-now?dryRun=true|false` → triggers `sendMarketingPosts` immediately. Default is `dryRun=true`. Returns `{ ok, summary, channels }`. Use this for copy reviews.
- `POST /admin/post-daily?dryRun=true|false` → same payload but tagged as the standard daily dispatch.
- `POST /admin/marketing-blast` with JSON `{ "topic": "FOMC outlook", "dryRun": true }` → reuses the same marketing service for ad-hoc blasts (topic becomes the “date” label). Always start with `dryRun:true` to avoid spamming channels.
- Legacy `/admin/test-telegram` and `/admin/test-discord` still exist for single-channel verifications.

## Monitoring & debugging
- Health endpoints: `/status`, `/healthz`, `/diagnostics`, and `/signals/today`. Run `scripts/check-prod.sh` for a quick sweep after any deployment.
- `/diagnostics` lists the canonical API base and the CORS-safe endpoints; use it when Hostinger complains about fetches.
- Render dashboard → Logs is the primary source for signal builder warnings (`signals.build.reject`, `signals.equity.fetch_failed`). Empty arrays are valid; never fake content.
- GitHub Actions:
  - `marketing-daily` (cron weekdays 21:00 UTC) and `marketing-weekly` (Sunday 17:00 UTC) call `sendMarketingPosts`. They should succeed even if channels are unconfigured; check the job logs for `marketing-*-complete`.
  - Set `MARKETING_DRY_RUN=true` whenever you need a safe rehearsal. Flip to `false` only when you're ready for real posts.

## Investigating issues
- **Failed marketing preview**: hit `/marketing/preview` and `/diagnostics`. If `ok:false`, check Polygon/CoinGecko keys.
- **Stripe checkout issues**: verify `STRIPE_*` env vars on Render, confirm `docs/RENDER_ENV.md`, and tail Render logs for `/stripe/*` errors.
- **Telegram/Discord delivery gaps**: `GET /admin/test-all` surfaces whether secrets are missing. For deeper tests use `/admin/test-telegram` or `/admin/test-discord`.
- **Hostinger copy stale**: ensure Hostinger caches are cleared and that `/marketing/preview` timestamps move. If not, re-run `/admin/post-now?dryRun=true` and check Render logs.

## Rotating keys & tokens
- Telegram: update `TELEGRAM_BOT_TOKEN` plus the relevant chat IDs on Render and GitHub secrets. Use `/admin/test-telegram` in `dryRun=false` mode only after verifying the new bot credentials.
- Discord: update `MARKETING_DISCORD_WEBHOOK_URL` (and tier-specific webhooks if needed). Use `/admin/test-discord` to validate.
- X/Twitter: rotate `X_BEARER_TOKEN` / `X_ACCESS_TOKEN` in both Render and GitHub secrets; X posts are skipped automatically until new tokens exist.
- Stripe, Polygon, CoinGecko: rotate secrets inside Render first, then run `scripts/redeploy.sh` to propagate the env without code changes.

## Canonical URLs
- API base: `https://aurora-signals.onrender.com`
- Marketing site: `https://manysignals.finance`
- Public JSON endpoints: `/status`, `/healthz`, `/metrics`, `/metrics/weekly`, `/diagnostics`, `/signals/today`, `/marketing/preview`, `/about`, `/blog`, `/legal`
