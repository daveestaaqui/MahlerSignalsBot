import db from '../lib/db.js';
import { runStocks } from '../pipeline/stocks/index.js';
import { runCrypto } from '../pipeline/crypto/index.js';
import { STOCK_UNIVERSE } from '../config/universe.js';
import { TIER_GATES } from '../config/tiers.js';
import { broadcast, postX } from '../services/posters.js';
import { fmtEliteStock, fmtEliteCrypto, fmtPro, fmtFreeTeaser } from '../services/formatters.js';
import { canPublish } from '../services/gating.js';
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

export async function runOnce() {
  const stockSignals = await runStocks(STOCK_UNIVERSE as unknown as string[]);
  const cryptoSignals = await runCrypto();
  const allSignals = [...stockSignals, ...cryptoSignals];

  const teaserSymbols: string[] = [];

  for (const signal of allSignals) {
    const signalId = upsertSignal(signal);
    enqueueForTiers(signalId, signal);
    if (signal.asset_type === 'stock') {
      teaserSymbols.push(signal.symbol);
    }
  }

  if (teaserSymbols.length) {
    const unique = Array.from(new Set(teaserSymbols)).slice(0, 3);
    await postX(`Stocks in play: ${unique.join(' / ')} • Free channel gets 24h delayed access. Upgrade at https://aurora-signals.onrender.com`);
  }
}

function upsertSignal(signal: SignalRecord): number {
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
  const row = selectSignalIdStmt.get(signal.uniq_key) as { id: number };
  return row.id;
}

function enqueueForTiers(signalId: number, signal: SignalRecord) {
  const now = Math.floor(Date.now() / 1000);
  const freeReady = signal.embargo_until ?? (now + TIER_GATES.free.delaySeconds);
  const base = {
    symbol: signal.symbol,
    price: signal.features?.price,
    pct: signal.features?.pct_change_1d,
    rvol: signal.features?.rvol,
    reason: signal.reason,
    score: signal.score,
    subs: signal.features?.subs || {},
    tier: 'pro' as const,
    assetType: signal.asset_type,
  };

  if(canPublish('elite', { asset: signal.asset_type, whale: Boolean(signal.features?.whales || signal.features?.whaleScore), options: Boolean(signal.features?.optionsScore) })){
    queueStmt.run({ signal_id: signalId, tier: 'elite', payload: signal.asset_type==='crypto' ? fmtEliteCrypto(base) : fmtEliteStock(base), ready_at: signal.created_at });
  }

  if(canPublish('pro', { asset: signal.asset_type, whale: Boolean(signal.features?.whales || signal.features?.whaleScore), congress: Boolean(signal.features?.congressScore), options: Boolean(signal.features?.optionsScore) })){
    queueStmt.run({ signal_id: signalId, tier: 'pro', payload: fmtPro(base), ready_at: signal.created_at });
  }

  if(canPublish('free', { asset: signal.asset_type })){
    queueStmt.run({ signal_id: signalId, tier: 'free', payload: fmtFreeTeaser(base), ready_at: freeReady });
  }
}
