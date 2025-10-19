import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, PRICES, FEATURES, MONTHLY_PRO, MONTHLY_ELITE, PRICE_MAP } from '../src/config/pricing';

describe('pricing configuration', () => {
  it('exposes the expected tiers', () => {
    assert.deepEqual(TIERS, ['FREE', 'PRO', 'ELITE']);
  });

  it('defines monthly price points', () => {
    assert.equal(PRICES.PRO.monthly, 14);
    assert.equal(PRICES.ELITE.monthly, 39);
    assert.equal(MONTHLY_PRO, 14);
    assert.equal(MONTHLY_ELITE, 39);
    assert.ok(!('yearly' in PRICES.PRO));
    assert.ok(!('yearly' in PRICES.ELITE));
  });

  it('sets feature flags for each tier', () => {
    assert.equal(FEATURES.FREE.delayedHours, 24);
    assert.equal(FEATURES.FREE.alertsPerWeek, 3);
    assert.equal(FEATURES.PRO.alertsPerDay, 30);
    assert.equal(FEATURES.PRO.api, false);
    assert.equal(FEATURES.ELITE.alertsPerDay, Infinity);
    assert.equal(FEATURES.ELITE.api, true);
    assert.equal(FEATURES.ELITE.webhooks, true);
  });

  it('exposes only monthly price map entries', () => {
    assert.deepEqual(Object.keys(PRICE_MAP), ['PRO_MONTHLY', 'ELITE_MONTHLY']);
  });
});
