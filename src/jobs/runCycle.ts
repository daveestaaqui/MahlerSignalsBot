import db from '../lib/db.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { canPublish } from '../services/gating.js';
import { eliteStockMessage, eliteCryptoMessage, proMessage, freeTeaser } from '../services/formatters.js';
import type { SignalRecord } from '../signals/rules.js';

const insertSignalStmt = db.prepare(`
  INSERT INTO signals (symbol, asset_type, tier_min, score, reason, features, created_at, embargo_until, uniq_key)
  VALUES (@symbol, @asset_type, @tier_min, @score, @reason, @features, @created_at, @embargo_until, @uniq_key)
  ON CONFLICT(uniq_key) DO UPDATE SET
    score = excluded.score,
    reason = excluded.reason,
    features = excluded.features,
    created_at = excluded.created_at,
    embargo_until = excluded.embargo_until
`);

const selectSignalIdStmt = db.prepare(`SELECT id FROM signals WHERE uniq_key = ?`);
const queueStmt = db.prepare(`
  INSERT INTO publish_queue (signal_id, tier, payload, ready_at, sent_at, attempts, last_error)
  VALUES (@signal_id, @tier, @payload, @ready_at, NULL, 0, NULL)
  ON CONFLICT(signal_id, tier) DO UPDATE SET
    payload = excluded.payload,
    ready_at = excluded.ready_at,
    sent_at = NULL,
    attempts = 0,
    last_error = NULL
`);

export async function runOnce(){
  const stockSignals = await runStocksOnce(STOCK_UNIVERSE as string[]);
  const cryptoSignals = await runCryptoOnce(CRYPTO_UNIVERSE as string[]);
  const combined = [...stockSignals, ...cryptoSignals];

  for(const signal of combined){
    const id = upsertSignal(signal);
    enqueueForTiers(id, signal);
  }
}

function upsertSignal(signal: SignalRecord){
  insertSignalStmt.run({
    symbol: signal.symbol,
    asset_type: signal.asset_type,
    tier_min: signal.tier_min,
    score: signal.score,
    reason: signal.reason,
    features: JSON.stringify(signal.features ?? {}),
    created_at: signal.created_at,
    embargo_until: signal.embargo_until ?? null,
    uniq_key: signal.uniq_key,
  });
  const row = selectSignalIdStmt.get(signal.uniq_key) as { id:number };
  return row.id;
}

function enqueueForTiers(signalId:number, signal:SignalRecord){
  const now = Math.floor(Date.now()/1000);
  const embargo = signal.embargo_until ?? now;
  const base = {
    symbol: signal.symbol,
    price: signal.features?.price,
    pct: signal.features?.pct_change_1d,
    rvol: signal.features?.rvol,
    reason: signal.reason,
    score: signal.score,
    subs: signal.features?.subs,
    assetType: signal.asset_type,
  };
  const context = {
    asset: signal.asset_type,
    whale: Boolean(signal.features?.whales || signal.features?.whaleScore),
    congress: Boolean(signal.features?.congressScore),
    options: Boolean(signal.features?.optionsScore),
  } as const;

  if(canPublish('elite', context)){
    const payload = signal.asset_type === 'crypto' ? eliteCryptoMessage(base) : eliteStockMessage(base);
    queueStmt.run({ signal_id: signalId, tier:'elite', payload, ready_at: now });
  }
  if(canPublish('pro', context)){
    const payload = proMessage(base);
    queueStmt.run({ signal_id: signalId, tier:'pro', payload, ready_at: now });
  }
  if(canPublish('free', context)){
    const payload = freeTeaser(base);
    queueStmt.run({ signal_id: signalId, tier:'free', payload, ready_at: embargo });
  }
}
