import db from '../lib/db.js';
import { runStocks } from '../pipeline/stocks/index.js';
import { runCrypto } from '../pipeline/crypto/index.js';
import { STOCK_UNIVERSE } from '../config/universe.js';
import { TIERS } from '../config/tiers.js';
import { broadcast, postX } from '../services/posters.js';
import { eliteCryptoMessage, eliteStockMessage, proStockMessage, freeTeaser } from '../services/formatters';
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
  const freeReady = signal.embargo_until ?? (now + TIERS.free.delaySeconds);

  if (signal.asset_type === 'stock') {
    queueStmt.run({
      signal_id: signalId,
      tier: 'pro',
      payload: proStockMessage(signal),
      ready_at: signal.created_at,
    });
    queueStmt.run({
      signal_id: signalId,
      tier: 'elite',
      payload: eliteStockMessage(signal),
      ready_at: signal.created_at,
    });
    queueStmt.run({
      signal_id: signalId,
      tier: 'free',
      payload: freeTeaser(signal),
      ready_at: freeReady,
    });
    return;
  }

  // Crypto: elite only, optional tease to free via X already handled
  queueStmt.run({
    signal_id: signalId,
    tier: 'elite',
    payload: eliteCryptoMessage(signal),
    ready_at: signal.created_at,
  });
}

function formatProMessage(signal: SignalRecord) {
  const f = signal.features || {};
  const rows = [
    `⭐ PRO • ${signal.symbol}`,
    `Score: ${signal.score.toFixed(2)} | ${signal.reason}`,
  ];
  if (signal.asset_type === 'stock') {
    rows.push(
      `Δ20d ${(f.pct_from_20d ?? 0).toFixed(1)}% | Δ200d ${(f.pct_from_200d ?? 0).toFixed(1)}%`,
      `RVOL ${(f.rvol ?? 1).toFixed(2)} | Sentiment ${( (f.sentiment ?? 0) * 100 ).toFixed(1)}%`
    );
  }
  return rows.join('\n');
}

function formatEliteMessage(signal: SignalRecord) {
  const isCrypto = signal.asset_type === 'crypto';
  const header = isCrypto ? '👑 ELITE CRYPTO' : '👑 ELITE STOCK';
  const rows = [
    `${header} • ${signal.symbol}`,
    `Score: ${signal.score.toFixed(2)} | ${signal.reason}`,
  ];
  if (!isCrypto) {
    const f = signal.features || {};
    rows.push(
      `Smart money ${( (f.smartMoneyScore ?? 0) * 100 ).toFixed(1)}% | Policy ${( (f.policyTailwind ?? 0) * 100 ).toFixed(1)}%`,
      `Sentiment ${( (f.sentiment ?? 0) * 100 ).toFixed(1)}%`
    );
  }
  return rows.join('\n');
}

function formatFreeMessage(signal: SignalRecord) {
  const rows = [
    `⌛ ${signal.symbol} triggered ${signal.score.toFixed(2)} yesterday.`,
    `Reason: ${signal.reason.split(' • ')[0] || signal.reason}`,
    `Upgrade to PRO for realtime entries: https://aurora-signals.onrender.com#pricing`,
  ];
  return rows.join('\n');
}
