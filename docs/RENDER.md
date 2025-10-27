## Render Deployment Notes

- **Build Command:** `pnpm install --frozen-lockfile && pnpm build`
- **Start Command:** `node dist/web/node.js`
- **Required Environment Variables:**
  - `POST_ENABLED=true`
  - `DRY_RUN=false`
  - `ADMIN_TOKEN` (Bearer token for admin routes)
  - `BASE_URL`
  - Upstream API keys as available (e.g., `POLYGON_KEY`, `FINNHUB_KEY`, `ALPHAVANTAGE_KEY`, `WHALE_ALERT_KEY`, messaging webhooks/tokens)
