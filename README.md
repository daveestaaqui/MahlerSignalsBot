# MCP n8n Bridge

Adapter connecting CodeRabbit MCP workflows to n8n automations.

## Pricing

- **Free — $0/mo**
- **Pro — $14/mo**
- **Elite — $39/mo**

### Tier Focus
- **FREE**: Stocks only, released 24 hours late to public channels.
- **PRO**: Real-time equities with advanced metrics (MA, RVOL, sentiment, policy tailwind) plus morning/evening recaps.
- **ELITE**: All PRO features plus crypto (ETH/SOL majors + curated alts) with on-chain and liquidity analytics.

Refer to `docs/PRICING.md` for detailed tier features.

## Quick Start

```bash
cp -n .env.example .env
npm start   # or: node dist/index.js
# Trigger a run now:
curl -X POST http://127.0.0.1:8787/admin/post
# Health:
node scripts/health.mjs /
```


## Commands

```bash
npm start           # start HTTP + scheduler
npm run once        # run signal cycle once now
npm run admin       # call /admin/post locally
npm run health      # GET /
npm run bot         # start Telegram bot (requires TELEGRAM_BOT_TOKEN)
```


## Operations

```bash
npm start                 # start HTTP + scheduler
npm run once              # run signal cycle once now
npm run admin             # POST /admin/post locally
npm run bot               # start Telegram bot (needs TELEGRAM_BOT_TOKEN)
# Set a user tier (app must be running):
npm run set-tier -- 123456789 PRO
# Trigger posting without HTTP:
npm run post-now
```


## Endpoints

```text
GET /                   # static pricing UI (links to monthly checkout)
GET /api/signals?tier=free|pro|elite   # JSON feed (FREE delayed 24h)
GET /status            # counts and last signal timestamp
POST /admin/post       # trigger a run (ad hoc)
POST /webhook/subscription  # {userId,tier}
GET /checkout/pro      # redirect to CHECKOUT_PRO_URL
GET /checkout/elite    # redirect to CHECKOUT_ELITE_URL
```


## Deployment

### PM2
```bash
pm2 start ops/ecosystem.config.cjs && pm2 save
pm2 logs aurora-signals
```

### systemd
```bash
useradd -r -m -s /bin/false aurora || true
mkdir -p /opt/aurora && chown -R aurora:aurora /opt/aurora
cp -r . /opt/aurora
cp .env.example /etc/aurora.env && nano /etc/aurora.env
cp ops/aurora-signals.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aurora-signals
journalctl -u aurora-signals -f
```

### Docker
```bash
docker build -t aurora:latest -f ops/Dockerfile .
docker run --rm -p 8787:8787 --env-file .env aurora:latest
```


## Production & Automation

- Protect `/admin/post` with `ADMIN_TOKEN` (Bearer).
- Set **GitHub Secrets**: `ADMIN_ENDPOINT_URL` (https://YOUR_HOST/admin/post) and `ADMIN_TOKEN`.
- Discord webhooks (free) can post per tier.
- Stripe-ready endpoints exist; swap in real keys when ready.


## One-click Deploy

### Option A: Cyclic (fastest, free)
1) Go to https://cyclic.sh/ → Connect GitHub → pick this repo.
2) It deploys automatically and gives you a URL like `https://your-app.cyclic.cloud`.
3) In GitHub → Settings → Secrets → Actions set:
   - `ADMIN_ENDPOINT_URL` = `https://YOUR-URL/admin/post`
   - `ADMIN_TOKEN` = same token as in your server `.env`.

### Option B: Render (free tier)
1) Go to https://render.com/ → New → **Blueprint** → point to this repo (has `render.yaml`).
2) After deploy, you get a URL like `https://aurora-signals.onrender.com`.
3) Add the same GitHub Secrets `ADMIN_ENDPOINT_URL` + `ADMIN_TOKEN`.

## Deploy on Render
1) Go to https://render.com → **New → Blueprint** → select this repo (it already contains `render.yaml`).
2) Once the first build finishes, open **Settings → Environment** and paste values from `ops/render.env.sample` (at minimum set a strong `ADMIN_TOKEN`).
3) Copy the External URL (for example `https://aurora-signals.onrender.com`).
4) Locally run `scripts/set-gh-secrets-hint.sh https://YOUR-RENDER-URL` and add those secrets to GitHub so the daily cron can call `/admin/post`.
5) Verify the endpoint:
   ```bash
   curl -X POST https://YOUR-RENDER-URL/admin/post \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" -sS
   ```
# MCP n8n Bridge

Adapter connecting CodeRabbit MCP workflows to n8n automations.

## Pricing

- **Free — $0/mo**
- **Pro — $14/mo**
- **Elite — $39/mo**

Refer to `docs/PRICING.md` for detailed tier features.

## Quick Start

```bash
cp -n .env.example .env
npm start   # or: node dist/index.js
# Trigger a run now:
curl -X POST http://127.0.0.1:8787/admin/post
# Health:
node scripts/health.mjs /
```


## Commands

```bash
npm start           # start HTTP + scheduler
npm run once        # run signal cycle once now
npm run admin       # call /admin/post locally
npm run health      # GET /
npm run bot         # start Telegram bot (requires TELEGRAM_BOT_TOKEN)
```


## Operations

```bash
npm start                 # start HTTP + scheduler
npm run once              # run signal cycle once now
npm run admin             # POST /admin/post locally
npm run bot               # start Telegram bot (needs TELEGRAM_BOT_TOKEN)
# Set a user tier (app must be running):
npm run set-tier -- 123456789 PRO
# Trigger posting without HTTP:
npm run post-now
```


## Endpoints

```text
GET /                   # static pricing UI (links to monthly checkout)
GET /api/signals?tier=free|pro|elite   # JSON feed (FREE delayed 24h)
GET /status            # counts and last signal timestamp
POST /admin/post       # trigger a run (ad hoc)
POST /webhook/subscription  # {userId,tier}
GET /checkout/pro      # redirect to CHECKOUT_PRO_URL
GET /checkout/elite    # redirect to CHECKOUT_ELITE_URL
```


## Deployment

### PM2
```bash
pm2 start ops/ecosystem.config.cjs && pm2 save
pm2 logs aurora-signals
```

### systemd
```bash
useradd -r -m -s /bin/false aurora || true
mkdir -p /opt/aurora && chown -R aurora:aurora /opt/aurora
cp -r . /opt/aurora
cp .env.example /etc/aurora.env && nano /etc/aurora.env
cp ops/aurora-signals.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aurora-signals
journalctl -u aurora-signals -f
```

### Docker
```bash
docker build -t aurora:latest -f ops/Dockerfile .
docker run --rm -p 8787:8787 --env-file .env aurora:latest
```


## Production & Automation

- Protect `/admin/post` with `ADMIN_TOKEN` (Bearer).
- Set **GitHub Secrets**: `ADMIN_ENDPOINT_URL` (https://YOUR_HOST/admin/post) and `ADMIN_TOKEN`.
- Discord webhooks (free) can post per tier.
- Stripe-ready endpoints exist; swap in real keys when ready.


## One-click Deploy

### Option A: Cyclic (fastest, free)
1) Go to https://cyclic.sh/ → Connect GitHub → pick this repo.
2) It deploys automatically and gives you a URL like `https://your-app.cyclic.cloud`.
3) In GitHub → Settings → Secrets → Actions set:
   - `ADMIN_ENDPOINT_URL` = `https://YOUR-URL/admin/post`
   - `ADMIN_TOKEN` = same token as in your server `.env`.

### Option B: Render (free tier)
1) Go to https://render.com/ → New → **Blueprint** → point to this repo (has `render.yaml`).
2) After deploy, you get a URL like `https://aurora-signals.onrender.com`.
3) Add the same GitHub Secrets `ADMIN_ENDPOINT_URL` + `ADMIN_TOKEN`.

## Deploy on Render
1) Go to https://render.com → **New → Blueprint** → select this repo (it already contains `render.yaml`).
2) Once the first build finishes, open **Settings → Environment** and paste values from `ops/render.env.sample` (at minimum set a strong `ADMIN_TOKEN`).
3) Copy the External URL (for example `https://aurora-signals.onrender.com`).
4) Locally run `scripts/set-gh-secrets-hint.sh https://YOUR-RENDER-URL` and add those secrets to GitHub so the daily cron can call `/admin/post`.
5) Verify the endpoint:
   ```bash
   curl -X POST https://YOUR-RENDER-URL/admin/post \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" -sS
   ```

## Render Blueprint Steps
1) On Render → **Blueprints** → pick *AuroraSignals*.
2) Click **Manual sync** (top-right) to pull latest commit.
3) Click **Generate Blueprint**.
4) Click **Create web service aurora-signals**.
5) After it creates the service: open it → **Settings → Environment** → set `ADMIN_TOKEN` (strong), then Save.
6) Copy the External URL displayed at top (https://<name>-<hash>.onrender.com).


## AuroraSignalX Bring-up (5-min)
1) Render → Service → Environment: set ADMIN_TOKEN, CONTACT_EMAIL, BASE_URL.
2) Stripe set: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRICE_ID_PRO, PRICE_ID_ELITE.
3) Telegram 2-tier: `make tiers-telegram` → paste token, confirm @AuroraSignalX_pro / @AuroraSignalX_elite → follow output to set Render env.
4) Discord (FREE marketing): set DISCORD_WEBHOOK_URL_FREE → `make discord`.
5) X (optional): set X_* → `make x`.
6) Verify: `make smoke && make ping` → `/setup` shows HAS_TELEGRAM_PRO/ELITE.
