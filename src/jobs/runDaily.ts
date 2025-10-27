import db from '../lib/db.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { selectDailySignals } from '../services/selector.js';
import { canPublish } from '../services/gating.js';
import { eliteStockMessage, eliteCryptoMessage, proMessage, freeTeaser } from '../services/formatters.js';
import { TIER_GATES } from '../config/tiers.js';
import { POSTING_RULES } from '../config/posting.js';
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

export type DailyRunResult = {
  generatedAt: string;
  dryRun: boolean;
  postEnabled: boolean;
  candidates: {
    total: number;
    stock: number;
    crypto: number;
  };
  selected: Array<{
    symbol: string;
    assetType: 'stock' | 'crypto';
    score: number;
    tier: 'pro' | 'elite';
    autoPass: boolean;
    flowUsd: number;
  }>;
  rejected: Array<{
    symbol: string;
    assetType: 'stock' | 'crypto';
    reason: string;
  }>;
  capacity: {
    stock: { limit: number; remaining: number };
    crypto: { limit: number; remaining: number };
  };
  selectionMeta: {
    now: number;
    cooldownCutoff: number;
  };
};

export async function runDailyOnce(): Promise<DailyRunResult> {
  const [stockSignals, cryptoSignals] = await Promise.all([
    runStocksOnce(STOCK_UNIVERSE),
    runCryptoOnce(CRYPTO_UNIVERSE),
  ]);

  const candidates = [...stockSignals, ...cryptoSignals];
  const selection = selectDailySignals(candidates);

  const queued: SignalRecord[] = [];
  for (const { signal } of selection.selected) {
    const id = upsertSignal(signal);
    enqueueForTiers(id, signal);
    queued.push(signal);
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun: (process.env.DRY_RUN || 'false').toLowerCase() === 'true',
    postEnabled: (process.env.POST_ENABLED || 'true').toLowerCase() === 'true',
    candidates: {
      total: candidates.length,
      stock: stockSignals.length,
      crypto: cryptoSignals.length,
    },
    selected: selection.selected.map(({ signal, autoPass, flowUsd }) => ({
      symbol: signal.symbol,
      assetType: signal.asset_type,
      score: signal.score,
      tier: signal.tier_min === 'elite' ? 'elite' : 'pro',
      autoPass,
      flowUsd,
    })),
    rejected: selection.rejected.map(({ signal, reason }) => ({
      symbol: signal.symbol,
      assetType: signal.asset_type,
      reason,
    })),
    capacity: selection.capacity,
    selectionMeta: selection.meta,
  };
}

function upsertSignal(signal: SignalRecord) {
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
  const context = {
    asset: signal.asset_type,
    whale: Boolean(signal.features?.whales || signal.features?.whaleScore),
    congress: Boolean(signal.features?.congressScore),
    options: Boolean(signal.features?.optionsScore),
  } as const;
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

  if (canPublish('elite', context) && signal.score >= POSTING_RULES.MIN_SCORE_ELITE) {
    const payload = signal.asset_type === 'crypto' ? eliteCryptoMessage(base) : eliteStockMessage(base);
    queueStmt.run({ signal_id: signalId, tier: 'elite', payload, ready_at: now });
  }
  if (canPublish('pro', context) && signal.score >= POSTING_RULES.MIN_SCORE_PRO) {
    const payload = proMessage(base);
    queueStmt.run({ signal_id: signalId, tier: 'pro', payload, ready_at: now });
  }
  if (canPublish('free', context)) {
    const payload = freeTeaser(base);
    queueStmt.run({ signal_id: signalId, tier: 'free', payload, ready_at: freeReady });
  }
}
