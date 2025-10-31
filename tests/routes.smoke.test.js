import { strict as assert } from 'node:assert';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DRY_RUN = 'true';
process.env.POST_ENABLED = 'true';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.ADMIN_TOKEN = 'test-token';

const adminToken = process.env.ADMIN_TOKEN;

const makeRunResult = (preview) => {
  const now = Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    dryRun: process.env.DRY_RUN === 'true',
    postEnabled: process.env.POST_ENABLED === 'true',
    preview,
    posted: 0,
    reason: preview ? 'preview' : 'dry_run',
    providerErrors: [],
    errors: [],
    telemetry: [],
    cadence: {
      date: '2024-01-01',
      limits: { total: 2, byAsset: { stock: 1, crypto: 1 } },
      before: { stock: 0, crypto: 0 },
      after: { stock: 0, crypto: 0 },
    },
    candidates: { total: 1, stock: 1, crypto: 0 },
    selected: [],
    rejected: [],
    capacity: {
      total: { limit: 2, remaining: 2 },
      byAsset: {
        stock: { limit: 1, remaining: 1 },
        crypto: { limit: 1, remaining: 1 },
      },
    },
    capacityBefore: {
      total: 2,
      byAsset: { stock: 1, crypto: 1 },
    },
    selectionMeta: { now, cooldownCutoff: now },
    messages: preview
      ? [
          {
            tier: 'pro',
            asset: 'stock',
            telegram: 'Pro alert AAPL',
            plain: 'Pro alert AAPL',
            compact: 'Pro alert AAPL',
            symbols: ['AAPL'],
          },
        ]
      : [],
    dispatch: [],
  };
};

const serverModule = await import('../dist/web/server.js');
const { app, setRunDailyRunner, resetRunDailyRunner } = serverModule;

setRunDailyRunner(async (options = {}) => makeRunResult(Boolean(options.preview)));

test.after(() => {
  resetRunDailyRunner();
});

test('GET /status returns ok', async () => {
  const res = await app.request('/status');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.cadence.timezone, 'America/New_York');
});

test('GET /preview/daily returns within timeout window', async () => {
  const start = Date.now();
  const res = await app.request('/preview/daily?limit=2&minScore=0.9', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const duration = Date.now() - start;
  assert.ok(duration < 3000);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
});

test('GET /api/preview/daily mirrors handler', async () => {
  const res = await app.request('/api/preview/daily', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
});

test('Admin endpoints accept DRY_RUN execution', async () => {
  const routes = [
    ['/admin/unlock', 'POST'],
    ['/admin/post-now?force=true&minScore=0.10', 'POST'],
    ['/admin/post-daily', 'POST'],
    ['/admin/post-weekly', 'POST'],
    ['/admin/test-telegram', 'POST'],
    ['/admin/test-discord', 'POST'],
  ];

  for (const [path, method] of routes) {
    const res = await app.request(path, {
      method,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.ok(res.status === 200 || res.status === 202);
    const body = await res.json();
    assert.ok(body.ok);
  }
});
