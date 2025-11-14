# Marketing + Hostinger Runbook

## Layers
- **Render API** (`https://aurora-signals.onrender.com`): Express/TypeScript backend that serves JSON, admin routes, and marketing preview data.
- **Hostinger site** (`https://manysignals.finance`): Static marketing pages that call the API for live content.
- **Channels**: Telegram (tier chats + marketing group), Discord, and optional X/Twitter posts driven by `sendMarketingPosts`.

## Hostinger integration
- Allowlisted origins: `https://manysignals.finance` and `https://www.manysignals.finance` (plus localhost in dev). Anything else is rejected by CORS.
- Recommended endpoints:
  - `GET /marketing/preview` → top 3 SignalView objects + `updatedAt` + canonical disclaimer (use for hero cards).
  - `GET /signals/today` → full array for “live signals” sections.
  - `GET /about` and `GET /legal` → copy blocks for FAQ/legal pages.
  - `GET /diagnostics` → quick JSON status (lists all public endpoints, includes version/env/time).
- Frontend fallback: if Hostinger is down, run `pnpm dev` locally and hit `http://localhost:3000` (the static bundle points at the Render API by default).

## Marketing service
- `sendMarketingPosts(date, options)` in `src/services/marketing.ts` is the single dispatcher. It fetches live `SignalView` data, composes “ManySignals Finance Daily/Weekly” copy, appends the shared disclaimer, and dispatches to Telegram, Discord, and X using the configured env vars. Missing secrets trigger log entries like `marketing.channel_skipped`.
- Options support `{ template: 'daily' | 'weekly', dryRun, channels }`. `dryRun` returns the composed summary without touching channels.
- Channel summaries (`channels` array) record `attempted`/`ok` per provider so ops can see what was posted.

## Admin & automation
- Admin endpoints (`Authorization: Bearer ADMIN_TOKEN`):
  - `POST /admin/post-now?dryRun=true|false` → immediate dispatch using the daily template.
  - `POST /admin/post-daily?dryRun=true|false` → runs the same flow used by the scheduled cron.
  - `POST /admin/marketing-blast` JSON `{ "topic": "FOMC outlook", "dryRun": true }` → lets you label custom blasts (topic is used as the “date” string).
  - `GET /admin/test-all` → returns `{ ok, checks }` for `/signals/today`, `/marketing/preview`, and whether Telegram/Discord/X secrets exist.
  - `POST /admin/test-telegram` / `POST /admin/test-discord` → fire-and-forget health pings for single channels.
- GitHub Actions:
  - `.github/workflows/marketing-daily.yml` (cron `0 21 * * 1-5`) and `.github/workflows/marketing-weekly.yml` (cron `0 17 * * SUN`) run `pnpm install`, `pnpm build`, and then call `sendMarketingPosts` via `pnpm tsx -e`. The scripts log `marketing-*-complete` on success and exit non-zero on failure.
  - Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_*` or `MARKETING_TELEGRAM_CHAT_ID`, `MARKETING_DISCORD_WEBHOOK_URL` (or base Discord webhook), `X_BEARER_TOKEN`, and `MARKETING_DRY_RUN`.

## Going live safely
1. Keep `MARKETING_DRY_RUN="true"` on Render and in GitHub secrets. Trigger `/admin/post-now?dryRun=true` to inspect the latest copy in the logs.
2. Run both workflows manually from GitHub (`Run workflow` → keep dry run true). Confirm they succeed and skip unconfigured channels gracefully.
3. Flip `MARKETING_DRY_RUN` to `"false"` (Render and GitHub) once you're satisfied with the previews. Re-run `/admin/test-all` and `/admin/post-now?dryRun=false` to ensure each channel reports `attempted: true`.
4. Monitor Hostinger for fresh `/marketing/preview` timestamps. If the preview lags, re-run `/admin/post-now?dryRun=true` to regenerate copy without posting.

## Deployment & env checklist
- Render env vars: see `docs/RENDER_ENV.md` (BASE_URL, ADMIN_TOKEN, STRIPE keys, Telegram/Discord chat IDs, MARKETING_* flags, deploy hook, etc.).
- GitHub secrets must include marketing channel credentials plus `MARKETING_DRY_RUN`.
- Use `scripts/check-prod.sh` followed by `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://aurora-signals.onrender.com/admin/test-all` after any deploy; the first script validates `/status`, `/healthz`, `/signals/today`, `/marketing/preview`, `/diagnostics`.
- `scripts/redeploy.sh "chore: refresh marketing"` wraps build/test/commit/push + Render deploy hook for manual releases.
