# Aurora-Signals Ops Runbook

Aurora-Signals is a Node 20/Express app deployed on Render. It exposes:
- /status
- /healthz
- /metrics
- /legal
- /blog and /blog/{slug}
- static files from /public (robots.txt, sitemap.xml)

> This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.

## Normal Operation

- /status → 200, JSON { ok: true, ts }
- /healthz → 200, body "ok"
- /metrics → 200, JSON with ok, ts, version
- /legal → 200, markdown with disclaimer
- /blog → 200, JSON listing blog posts
- /blog/{slug} → 200, markdown post
- /robots.txt and /sitemap.xml → 200

Admin endpoints (/admin/*) require a Bearer token (ADMIN_TOKEN) and return 401 when missing/invalid.

## Health Monitoring

- GitHub workflow: .github/workflows/AURORA-health-monitor.yml
- Runs hourly and on manual dispatch.
- Calls /healthz and /metrics and fails if status != 200.

## Common Incidents

### Deploy failed / 5xx on Render

1. Check Render deploy logs (build errors, runtime stack traces).
2. Confirm pnpm install + pnpm run build succeed locally.
3. If needed, redeploy a known-good commit from Render's Deploys page.
4. Fix the offending code, merge to main, redeploy.

### /legal or /blog returning 404

- Verify docs/legal.md exists.
- Verify docs/blog has at least one .md file.
- Ensure routes/legal and routes/blog are mounted in src/web/server.ts.
- Redeploy after fixing.

### /status or /healthz not 200

- Check recent code changes around server bootstrap.
- Reproduce locally: pnpm run build && node dist/web/server.js.
- Curl /status and /healthz to confirm behavior.
- Roll back or patch-forward as needed.

## Token Rotation

- ADMIN_TOKEN lives in Render env vars (and optionally local .env).
- To rotate:
  1. Generate a new secure token.
  2. Update Render ADMIN_TOKEN.
  3. Update local .env and any CI secrets that use it.
  4. Confirm admin endpoints accept the new token.

## On-Call Playbook

- Monitor:
  - GitHub Actions (AURORA health monitor).
  - Render logs (5xx, restarts).
- First responder:
  - Checks /status, /healthz, /metrics, /legal.
  - Pages secondary if outage > 10 minutes.
