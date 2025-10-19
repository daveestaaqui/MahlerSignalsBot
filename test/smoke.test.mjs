import test from 'node:test';
import assert from 'node:assert/strict';
import * as pricing from '../dist/config/pricing.js';

test('pricing: monthly only', ()=>{
  assert.equal(pricing.PRICES.PRO.monthly, 14);
  assert.equal(pricing.PRICES.ELITE.monthly, 39);
  assert.ok(!('yearly' in pricing.PRICES.PRO));
});
