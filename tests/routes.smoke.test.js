import { strict as assert } from 'node:assert';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';

const adminToken = 'test-token';
process.env.ADMIN_TOKEN = adminToken;

const makeRunResult = () => ({
  generatedAt: new Date().toISOString(),
  dryRun: true,
  postEnabled: false,
  preview: true,
  cadence: {
    date: '2024-01-01',
    limits: {
      total: 10,
      byAsset: { stock: 5, crypto: 5 },
    },
    before: { stock: 0, crypto: 0 },
    after: { stock: 0, crypto: 0 },
  },
  candidates: {
    total: 2,
    stock: 1,
    crypto: 1,
  },
  selected: [
    { symbol: 'AAPL', assetType: 'stock', tier: 'pro', score: 0.91, flowUsd: 500000, autoPass: true },
    { symbol: 'ETH', assetType: 'crypto', tier: 'elite', score: 0.93, flowUsd: 750000, autoPass: true },
  ],
  rejected: [],
  capacity: {
    total: { limit: 10, remaining: 10 },
    byAsset: {
      stock: { limit: 5, remaining: 5 },
      crypto: { limit: 5, remaining: 5 },
    },
  },
  capacityBefore: {
    total: 10,
    byAsset: { stock: 5, crypto: 5 },
  },
  selectionMeta: {
    now: Date.now(),
    cooldownCutoff: Date.now(),
  },
  messages: [
    {
      tier: 'pro',
      asset: 'stock',
      telegram: 'Pro alert AAPL',
      plain: 'Pro alert AAPL',
      compact: 'Pro alert AAPL',
      symbols: ['AAPL'],
    },
  ],
});

const serverModule = await import('../dist/web/server.js');
const { app, setRunDailyRunner, resetRunDailyRunner } = serverModule;

setRunDailyRunner(async () => makeRunResult());

test.after(() => {
  resetRunDailyRunner();
});

test('GET /status returns ok', async () => {
  const res = await app.request('/status');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('GET /api/status mirrors primary route', async () => {
  const res = await app.request('/api/status');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('GET /health/providers exposes promo flags', async () => {
  const res = await app.request('/health/providers');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.promo);
});

test('GET /preview/daily succeeds with admin auth', async () => {
  const res = await app.request('/preview/daily?limit=2&minScore=0.9', {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.context?.limit, 2);
  assert.equal(body.context?.minScore, 0.9);
});
