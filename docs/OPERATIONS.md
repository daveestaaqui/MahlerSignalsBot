# Operations Guide

## Environment Flags

- `POST_ENABLED` (`true` | `false`): Master toggle for delivering messages to Telegram/Discord. When `false` the system queues signals but delivery services only log dry-run payloads.
- `DRY_RUN` (`true` | `false`): Forces all external adapters to use mock data where possible and downgrades poster activity to logging-only mode. Useful for staging smoke-tests.
- `DAILY_POST_CAP` (default `2`): Maximum number of signals per asset class (`stock`, `crypto`) that can be queued each day. Historical sends reduce the remaining quota automatically.
- `MIN_SCORE_PRO` (default `0.85`): Minimum composite score required for a signal to qualify for Pro distribution unless whale flow auto-pass triggers.
- `MIN_SCORE_ELITE` (default `0.90`): Minimum composite score required for Elite tier distribution.
- `FLOW_USD_MIN` (default `2000000`): Whale flow notional (USD) that guarantees a candidate survives scoring filters.
- `COOLDOWN_DAYS` (default `3`): Symbol-level cooldown before another send will be considered eligible.

## Admin Endpoints

All admin routes require `Authorization: Bearer ${ADMIN_TOKEN}`.

- `GET /status` – Health snapshot with posting rules and environment flags.
- `GET /diagnostics` – Extended environment diagnostics including credential presence checks.
- `GET /weekly-summary` – JSON payload of the latest KPI rollup (last 7 days).
- `POST /admin/post-daily` – Runs the full daily pipeline (stock + crypto harvest, selection, queueing) and immediately flushes the publish queue. Returns the selection report.
- `POST /admin/post-weekly` – Generates the weekly digest body, broadcasts to PRO and ELITE (respecting `POST_ENABLED` / `DRY_RUN`), and returns delivery status plus the rendered preview.

## One-Off Runs

1. Ensure environment variables (particularly `ADMIN_TOKEN`, posting flags, and API keys) are exported in the shell or defined in `.env`.
2. Build the project if TypeScript changes were made: `npm run build`.
3. Execute a dry-run of the pipeline without hitting the admin API:
   ```bash
   node -e "import('./dist/jobs/runDaily.js').then(m => m.runDailyOnce()).then(console.log)"
   ```
   Set `DRY_RUN=true` to avoid hitting live data providers.
4. To trigger from the admin surface instead, call `POST /admin/post-daily` with the bearer token; this will also flush the publish queue.
