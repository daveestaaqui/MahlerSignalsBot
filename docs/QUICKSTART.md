
```bash
pnpm dev # or pnpm start once built
```

Visit http://localhost:3000 to verify `/status`, `/healthz`, `/metrics`, `/legal`, `/blog`, and `/blog/hello-world`.

## Deploying

1. Push to `main`.
2. Ensure Render service is configured with build command `pnpm install --frozen-lockfile && pnpm run build` and start command `node dist/web/server.js`.
3. Trigger deploy via Render (UI or API).
4. Run the smoke test:

```bash
BASE=https://aurora-signals.onrender.com node scripts/check-endpoints.mjs
```

If any endpoint fails, consult `docs/ops-runbook.md` for recovery steps.
