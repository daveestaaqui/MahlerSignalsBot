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

