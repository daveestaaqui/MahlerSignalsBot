# AuroraSignalX Operations Guide

## Deployment Toggles
- `POST_ENABLED=true|false` controls whether messages are actually sent.
- `DRY_RUN=true|false` keeps messages local (logged) but prevents external posting.
  - On Render: Settings → Environment → update and redeploy.
  - Locally: export variables before running `make diagnostics` or `make once`.

## Running Pipelines Manually
```bash
cd ~/n8n/mcp-n8n
export BASE_URL="https://aurora-signals.onrender.com"
export ADMIN_TOKEN="<admin-token>"
make diagnostics     # checks /diagnostics health
make once            # invokes current pipelines respecting caps
```

## Logs & Monitoring
- Render dashboard → Logs stream shows structured JSON (`level`, `msg`).
- GitHub Actions `signal-scheduler` runs at 09:05 and 15:05 ET weekdays, weekly digest Sunday 17:00 ET.
- `/diagnostics` exposes environment toggles and queue depth.
- `/weekly-summary` returns last seven days stats (counts, win/loss placeholder, top movers).

## Pausing Jobs
- On Render: set `POST_ENABLED=false` (and optionally `DRY_RUN=true`).
- For complete pause: disable GitHub Action `signal-scheduler` or revoke `BASE_URL` secret.

## Token Rotation
1. Generate new token.
2. Update Render environment (`ADMIN_TOKEN`, Telegram/X/Discord keys).
3. Update GitHub secrets (`BASE_URL`, `ADMIN_TOKEN`, Telegram keys if posting from Actions).
4. Redeploy Render and run `make diagnostics` to confirm.
