# Ops Runbook

## Health & Status
- GET /status → 200
- GET /healthz → 200

## Admin API (Authorization: Bearer ${ADMIN_TOKEN})
- POST /admin/post-now         {}
- POST /admin/post-daily       {"dryRun":true}
- POST /admin/post-weekly      {"dryRun":true}
- POST /admin/test-telegram    {}
- POST /admin/test-discord     {}

## Render CLI/API
- Create deploy: POST /v1/services/${RENDER_SERVICE_ID}/deploys { "clearCache": true, "branch": "main" }
- Poll: GET /v1/deploys/${DEPLOY_ID} → status: live|failed
