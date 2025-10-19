import test from 'node:test';
import assert from 'node:assert/strict';
import * as pricing from '../dist/config/pricing.js';

test('tiers only FREE/PRO/ELITE', () => {
  assert.deepEqual(pricing.TIERS, ['FREE','PRO','ELITE']);
});

test('monthly price points only', () => {
  assert.equal(pricing.PRICES.PRO.monthly, 14);
  assert.equal(pricing.PRICES.ELITE.monthly, 39);
  assert.equal(pricing.MONTHLY_PRO, 14);
  assert.equal(pricing.MONTHLY_ELITE, 39);
  assert.ok(!('yearly' in pricing.PRICES.PRO));
  assert.ok(!('yearly' in pricing.PRICES.ELITE));
});

test('feature flags per tier', () => {
  assert.equal(pricing.FEATURES.FREE.delayedHours, 24);
  assert.equal(pricing.FEATURES.FREE.alertsPerWeek, 3);
  assert.equal(pricing.FEATURES.PRO.alertsPerDay, 30);
  assert.equal(pricing.FEATURES.PRO.api, false);
  assert.equal(pricing.FEATURES.ELITE.alertsPerDay, Infinity);
  assert.equal(pricing.FEATURES.ELITE.api, true);
  assert.equal(pricing.FEATURES.ELITE.webhooks, true);
});

test('price map only monthly entries', () => {
  assert.deepEqual(Object.keys(pricing.PRICE_MAP), ['PRO_MONTHLY','ELITE_MONTHLY']);
});
