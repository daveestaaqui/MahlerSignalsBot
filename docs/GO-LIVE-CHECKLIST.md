# Aurora-Signals Go-Live Checklist

> This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.

## Pre-Deploy

- [ ] All PRs reviewed and merged into `main`.
- [ ] `.github/workflows/ci.yml` passing on `main`.
- [ ] `.github/workflows/AURORA-health-monitor.yml` present.
- [ ] `docs/legal.md` includes the required disclaimer text.
- [ ] At least one blog post in `docs/blog/*.md`.
- [ ] `public/robots.txt` and `public/sitemap.xml` exist and reference the correct base URL.
- [ ] `ADMIN_TOKEN` and `BASE_URL` set in Render environment.
- [ ] Any Discord/Telegram/X/LinkedIn secrets configured (if used).

## Deploy

- [ ] Render deploy for latest `main` commit finished successfully.
- [ ] `/status` returns HTTP 200 and JSON `{ "ok": true, "ts": ... }`.
- [ ] `/healthz` returns HTTP 200 and body `ok`.
- [ ] `/metrics` returns HTTP 200 with `version` and `ts`.
- [ ] `/legal` returns HTTP 200 and contains the disclaimer line:
      "This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice."
- [ ] `/blog` returns HTTP 200 and lists posts.
- [ ] `/blog/hello-world` (or another slug) returns HTTP 200 and serves markdown.
- [ ] `/robots.txt` and `/sitemap.xml` return HTTP 200.

## Post-Deploy

- [ ] GitHub Actions "AURORA Health Monitor" last run succeeded.
- [ ] Optional: `post-deploy-check` workflow succeeded after merge.
- [ ] Admin endpoints (`/admin/*`) return 401 without token and 200 with valid `ADMIN_TOKEN`.
- [ ] No unexpected 5xx errors in Render logs.

## On-Going Ops

- [ ] Monitor hourly health monitor runs.
- [ ] Rotate `ADMIN_TOKEN` and other secrets regularly.
- [ ] Any new marketing copy or blog posts include the disclaimer text.
