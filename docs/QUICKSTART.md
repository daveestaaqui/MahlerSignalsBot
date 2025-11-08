# Aurora-Signals Quickstart

> This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.

## 1. Clone and install

```bash
git clone https://github.com/daveestaaqui/MahlerSignalsBot.git
cd MahlerSignalsBot
corepack enable
corepack prepare pnpm@9 --activate
pnpm install --no-frozen-lockfile
```

## 2. Configure env

Create a .env (not committed):

```
ADMIN_TOKEN=your-admin-token
BASE_URL=http://localhost:3000
```

## 3. Build and run

```bash
pnpm run build
node dist/web/server.js
```

Check:
- http://localhost:3000/status
- http://localhost:3000/healthz
- http://localhost:3000/legal

## 4. Deploy to Render

- Build command:
  ```bash
  corepack enable && corepack prepare pnpm@9 --activate && pnpm install --no-frozen-lockfile && pnpm run build
  ```
- Start command:
  ```bash
  node dist/web/server.js
  ```
- Set ADMIN_TOKEN and BASE_URL in Render env.

## 5. CI / Health

- CI: .github/workflows/ci.yml
- Health monitor: .github/workflows/AURORA-health-monitor.yml
