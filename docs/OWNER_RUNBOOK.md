# AuroraSignalX Owner Runbook

## Where Secrets Live
- Local development: `.env.local` (gitignored).
- Render → Service → Environment.
- GitHub → Settings → Secrets → Actions.
- Stripe dashboard holds live/test keys (rotate quarterly).

## Daily Ops Checklist
1. `./scripts/check-readiness.sh`
2. `./scripts/verify-suite.sh` (endpoints + Telegram queue test).
3. `sqlite3 db/app.sqlite 'SELECT COUNT(*) FROM publish_queue WHERE sent_at IS NULL;'` (non-zero = backlog).
4. Review cron success in GitHub (`ops-smoke` + `autopost-hourly`).

## Weekly
- Pull latest repo + redeploy Render.
- `node dist/index.js` locally to ensure scheduler / publish flush runs without crashing.
- Export subscription stats (Stripe → Payments → Customers) and compare to `users` table.

## Incident Response
1. Pause GitHub workflow (`autopost-hourly`) in Actions tab.
2. Toggle Render service “Suspend”.
3. Announce outage in Discord #announcements and Telegram channels (use pinned template).
4. Investigate logs: `render shell` or `tail logs/app.log`.

## Key Commands
- Rotate admin token: `npm run admin:rotate` (pending script) then update Render + GitHub secrets.
- Telegram diagnostics: `./scripts/tg-debug.sh`.
- Publish queue flush: `node -e "import('./dist/jobs/publishWorker.js').then(m=>m.flushPublishQueue())"`.
- Stripe webhook replay: `stripe events list` → `stripe events resend`.

## Pending Tasks (owner aware)
- Implement `bin/rotate-keys.sh` for API key rotation.
- Hook paid user upgrades to automatic Telegram invite removal when churn detected.
- Set up Grafana dashboard for connector latency + success rate.
