import db from '../lib/db.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { selectDailySignals } from '../services/selector.js';
import { canPublish } from '../services/gating.js';
import { fmtEliteStock, fmtEliteCrypto, fmtPro, fmtFreeTeaser, type MessageBase } from '../services/formatters.js';
import { TIER_GATES } from '../config/tiers.js';
import { POSTING_RULES } from '../config/posting.js';
import type { SignalRecord } from '../signals/rules.js';

type Tier = 'elite' | 'pro' | 'free';
type AssetClass = 'stock' | 'crypto';

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

const selectSignalIdStmt = db.prepare('SELECT id FROM signals WHERE uniq_key = ?');
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
    assetType: AssetClass;
    tier: 'pro' | 'elite';
    score: number;
    flowUsd: number;
    autoPass: boolean;
  }>;
  rejected: Array<{
    symbol: string;
    assetType: AssetClass;
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

type PersistedSignal = { id: number; record: SignalRecord };

export async function runDailyOnce(): Promise<DailyRunResult> {
  const [stockSignals, cryptoSignals] = await Promise.all([
    runStocksOnce(STOCK_UNIVERSE),
    runCryptoOnce(CRYPTO_UNIVERSE),
  ]);

  const candidates = [...stockSignals, ...cryptoSignals];
  const selection = selectDailySignals(candidates);

  const persisted: PersistedSignal[] = selection.selected.map(({ signal }) => ({
    id: upsertSignal(signal),
    record: signal,
  }));

  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const shouldDispatch = postEnabled && !dryRun;

  if (shouldDispatch) {
    enqueueBatches(persisted);
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    postEnabled,
    candidates: {
      total: candidates.length,
      stock: stockSignals.length,
      crypto: cryptoSignals.length,
    },
    selected: selection.selected.map(({ signal, autoPass, flowUsd }) => ({
      symbol: signal.symbol,
      assetType: signal.asset_type,
      tier: signal.tier_min === 'elite' ? 'elite' : 'pro',
      score: signal.score,
      flowUsd,
      autoPass,
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

function enqueueBatches(entries: PersistedSignal[]) {
  if (!entries.length) return;
  const now = Math.floor(Date.now() / 1000);

  const groups = buildGroups(entries);

  for (const group of groups) {
    const bases = group.entries.map(({ record }) => buildMessageBase(record));
    const formatted = formatForTier(group.tier, group.asset, bases);
    const readyAt = group.tier === 'free'
      ? Math.max(
          ...group.entries.map(({ record }) => record.embargo_until ?? now + TIER_GATES.free.delaySeconds),
        )
      : now;

    group.entries.forEach(({ id }) => {
      queueStmt.run({
        signal_id: id,
        tier: group.tier,
        payload: JSON.stringify({
          version: 2,
          tier: group.tier,
          asset: group.asset,
          message: formatted,
          symbols: group.entries.map(({ record }) => record.symbol),
        }),
        ready_at: readyAt,
      });
    });
  }
}

function buildGroups(entries: PersistedSignal[]): Array<{ tier: Tier; asset: AssetClass; entries: PersistedSignal[] }> {
  const grouped = new Map<string, { tier: Tier; asset: AssetClass; entries: PersistedSignal[] }>();
  const freeBuckets: Array<{ tier: Tier; asset: AssetClass; entries: PersistedSignal[] }> = [];

  for (const entry of entries) {
    const { record } = entry;
    const asset = record.asset_type;
    const context = {
      asset,
      whale: Boolean(record.features?.whales || record.features?.whaleScore),
      congress: Boolean(record.features?.congressScore),
      options: Boolean(record.features?.optionsScore),
    } as const;

    if (canPublish('elite', context) && record.score >= POSTING_RULES.MIN_SCORE_ELITE) {
      addToGroup(grouped, 'elite', asset, entry);
    }

    if (canPublish('pro', context) && record.score >= POSTING_RULES.MIN_SCORE_PRO) {
      addToGroup(grouped, 'pro', asset, entry);
    }

    if (canPublish('free', context)) {
      freeBuckets.push({ tier: 'free', asset, entries: [entry] });
    }
  }

  return [...grouped.values(), ...freeBuckets];
}

function addToGroup(
  map: Map<string, { tier: Tier; asset: AssetClass; entries: PersistedSignal[] }>,
  tier: Tier,
  asset: AssetClass,
  entry: PersistedSignal,
) {
  const key = `${tier}:${asset}`;
  if (!map.has(key)) {
    map.set(key, { tier, asset, entries: [] });
  }
  map.get(key)!.entries.push(entry);
}

function formatForTier(tier: Tier, asset: AssetClass, entries: MessageBase[]) {
  if (tier === 'elite') {
    return asset === 'stock' ? fmtEliteStock(entries) : fmtEliteCrypto(entries);
  }
  if (tier === 'pro') {
    return fmtPro(asset, entries);
  }
  return fmtFreeTeaser(asset, entries);
}

function buildMessageBase(signal: SignalRecord): MessageBase {
  return {
    symbol: signal.symbol,
    price: signal.features?.price,
    pct: signal.features?.pct_change_1d,
    rvol: signal.features?.rvol,
    reason: signal.reason,
    score: signal.score,
    subs: signal.features?.subs,
    assetType: signal.asset_type,
  };
}
