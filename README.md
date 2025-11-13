# ManySignals Backend (Aurora-Signals)

ManySignals is the marketing surface for Aurora-Signals, a Node 20 + Express backend that ships daily and weekly scenario-based signals for U.S. equities plus Ethereum/Solana majors. The production API already lives at **https://aurora-signals.onrender.com** and the marketing surfaces are the Hostinger site **https://manysignals.finance** plus embedded sections that call this API directly.

## What ships

- **Signals**: Intraday, next 1–3 day, and next 3–7 day scenarios with expected move ranges, illustrative stops, rationale (technical/fundamental/macro), risk notes, and canonical disclaimer text from `src/lib/legal.ts`.
- **Asset coverage**: Polygon equities watchlist (SPY, QQQ, NVDA, AAPL, MSFT, TSLA, …) plus CoinGecko majors (BTC, ETH, SOL, LINK, ARB, OP, etc.).
- **Pricing tiers**:
  - **Free — $0/mo**: Delayed US equity briefs to audit the format.
  - **Pro — $14/mo**: Real-time US equities with earlier refresh windows, technical + fundamental rationale, and webhook-ready payloads.
  - **Elite — $39/mo**: Everything in Pro plus crypto majors (ETH/SOL ecosystems), on-chain dominance metrics, and higher-touch roadmap access.
- **Tooling**: Static marketing bundle in `public/`, marketing automation scripts/templates, GitHub Actions for daily/weekly broadcasts, and Render-friendly deployment assets.

## Requirements

- Node.js 20.x and pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`).
- Real data provider keys (Polygon for equities, CoinGecko Pro if required, plus any optional crypto API keys). No fake data is injected—the system returns empty arrays when providers fail.
- Stripe keys for paid tiers: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_WEBHOOK_SECRET`.
- Optional broadcast credentials: Telegram bot token/chat IDs, Discord webhook(s), X API token/account ID.

## Quick start

```bash
pnpm install
cp .env.example .env.local
# populate real provider + Stripe keys
pnpm build
pnpm dev  # boots Express on http://localhost:3000
```

Set these minimum env vars locally or on Render:

```
BASE_URL=https://aurora-signals.onrender.com
STRIPE_SUCCESS_URL=https://manysignals.finance/checkout/success
STRIPE_CANCEL_URL=https://manysignals.finance/checkout/cancel
EQUITY_API_KEY=pk_live_your_polygon_key
CRYPTO_API_KEY=optional_coin_gecko_key
```

The static marketing bundle defaults to the production API base; override via the `<html data-api-base>` attribute or by setting `window.__MANY_SIGNALS_API__` in dev tools.

## Key endpoints

```
GET /status            # health summary
GET /healthz           # liveness probe
GET /metrics           # build + version info
GET /metrics/weekly    # aggregate performance snapshot
GET /diagnostics       # { ok, version, env, apiBase, publicEndpoints[] }
GET /marketing/preview # Hostinger marketing JSON (top 3 signals + disclaimer)
GET /signals/today     # array of SignalView objects
GET /about             # marketing copy + pricing tiers
GET /blog              # list of blog slugs
GET /blog/:slug        # markdown + disclaimer
GET /legal             # canonical disclaimer markdown
POST /stripe/checkout  # starts Stripe Checkout for pro/elite
POST /admin/post-now   # requires Authorization: Bearer ADMIN_TOKEN
```

All public GET endpoints support CORS for `https://manysignals.finance` and `https://www.manysignals.finance`.

## Hostinger + marketing JSON

- Hostinger sections fetch `/marketing/preview`, `/signals/today`, `/about`, `/diagnostics`, and `/legal` directly from `https://aurora-signals.onrender.com`.
- `/marketing/preview` returns the top three `SignalView` objects, a stable `updatedAt` ISO timestamp, and the canonical disclaimer for landing funnels.
- The Hostinger bundle uses the same tight CORS rules—only `https://manysignals.finance` (and the `www` alias) receive `GET/OPTIONS` headers.

## Admin + ops

- Set `ADMIN_TOKEN` for `/admin/*` routes. Use `scripts/ping-admin.sh` or `make post-now` to trigger manual cycles.
- `make diagnostics`, `scripts/check-prod.sh`, or `curl https://aurora-signals.onrender.com/diagnostics` return `{ ok, version, env, apiBase, publicEndpoints[] }` for a one-call smoke test.
- `scripts/redeploy.sh "<commit message>"` builds, tests, commits (if needed), pushes, and hits the Render deploy hook (set `RENDER_DEPLOY_HOOK` first).
- Run deep smoke tests before deploy: `BASE_URL=https://aurora-signals.onrender.com node scripts/check-endpoints.mjs`.
- Marketing workflows (`.github/workflows/marketing-*.yml`) pull signals from `https://aurora-signals.onrender.com/signals/today` and gracefully skip channels without secrets.
- `marketing/send-template.mjs` composes Telegram/Discord copy using the canonical disclaimer from `src/lib/legal.ts` (via the compiled dist module).
- All production env vars are documented in `docs/RENDER_ENV.md`; keep Render in sync with `.env.local`.

## Posting & marketing

- `sendMarketingPosts(date)` (in `src/services/marketing.ts`) feeds Telegram + Discord marketing channels, promo fan-out, and the X poster. Use `MARKETING_DRY_RUN=true pnpm tsx scripts/post-now.mjs` (or the admin endpoints) to preview without dispatching.
- CLI helpers: `scripts/send-telegram.sh "message"`, `scripts/send-discord.sh "message"`, and `scripts/send-x.sh "message"` validate channel connectivity; they fall back gracefully if tokens/webhooks are missing.
- Marketing workflows call `marketing/send-template.mjs` with the freshest signals JSON; you can reproduce locally via `node marketing/send-template.mjs daily signals.json`.
- To test the Hostinger payload, run `pnpm dev` and hit `http://localhost:3000/marketing/preview`.

## Deployment notes

- Render Web Service: build with `pnpm install && pnpm build`, start with `pnpm start`.
- Canonical API base remains `https://aurora-signals.onrender.com`. Point marketing or partner apps there for integrations.
- Marketing site lives at `https://manysignals.finance` but can fall back to this repo’s `public/` bundle for maintenance windows.

## Legal reminder

This platform never guarantees returns. Every signal includes the short disclaimer from `src/lib/legal.ts`, and downstream consumers must present the same language. When upstream data is missing or a provider fails, `/signals/today` returns an empty array or a safe error payload instead of fabricating values.
