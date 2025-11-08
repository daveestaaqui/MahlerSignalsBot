# Aurora-Signals Go-Live Checklist

> **Disclaimer:** This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.

## Pre-Deploy
- [ ] `pnpm install && pnpm run build` succeeds locally.
- [ ] `node dist/web/server.js` + `scripts/check-endpoints.mjs` return 200s.
- [ ] README + docs updated for any new features.
- [ ] Secrets (ADMIN_TOKEN, API keys) set in Render and GitHub.

## Deploy
- [ ] Merge PR into `main` (CI green).
- [ ] Trigger Render deploy (`render services deploy <service>` or via UI).
- [ ] Watch logs for successful boot (`listening on port ...`).

## Post-Deploy Validation
- [ ] `BASE=https://aurora-signals.onrender.com node scripts/check-endpoints.mjs` → all 200.
- [ ] Admin dry-run endpoints (`/admin/post-daily`, `/admin/post-weekly`) return 204 with `dryRun=true`.
- [ ] `.github/workflows/AURORA-health-monitor.yml` shows next scheduled run.
- [ ] Update `docs/post-deploy-report.md` with timestamp + statuses.

## Incident Response
- [ ] If 5xx detected, roll back via Render deploy history.
- [ ] Reference `docs/ops-runbook.md` for detailed steps.
- [ ] Communicate status in team channel.
