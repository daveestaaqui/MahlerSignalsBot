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

