# Aurora-Signals Ops Runbook

> **Disclaimer:** This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.

## Service Overview
- Node 20 + Express app served via Render (srv-d3r6fh7diees73argia0)
- CI via `.github/workflows/ci.yml`
- Health monitors via `.github/workflows/AURORA-health-monitor.yml`

## Key Endpoints
| Route | Purpose |
| ----- | ------- |
| `/status` | JSON `{ ok, ts }` uptime signal |
| `/healthz` | Plain `ok` for liveness |
| `/metrics` | JSON with version/build info |
| `/legal` | Markdown legal notice |
| `/blog` | Lists markdown posts |
| `/blog/{slug}` | Serves markdown article |
| `/robots.txt`, `/sitemap.xml` | SEO assets |

## Deploy Procedure
1. `pnpm install && pnpm run build`
2. `git push origin main`
3. `render services deploy $RENDER_SERVICE_ID`
4. Tail logs until `listening on port ...`

## Post-Deploy Checklist
- `BASE=https://aurora-signals.onrender.com node scripts/check-endpoints.mjs`
- Update `docs/post-deploy-report.md`
- Confirm GitHub health monitor succeeding

## Incident Response
1. Check `/healthz` and `/status`
2. Inspect Render logs
3. Reproduce locally with `node dist/web/server.js`
4. Roll back via Render deploy history if needed
5. Document root cause in repo `docs/` and team channel

## Secrets Rotation
- Update Render env vars (ADMIN_TOKEN, API keys)
- Update GitHub Actions secrets if needed
- Redeploy and verify admin routes require new token
