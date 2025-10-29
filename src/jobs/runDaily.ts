import db from '../lib/db.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { selectDailySignals, type SelectedSignal } from '../services/selector.js';
import { canPublish } from '../services/gating.js';
import { fmtEliteStock, fmtEliteCrypto, fmtPro, fmtFreeTeaser, type MessageBase, type FormattedMessage } from '../services/formatters.js';
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
    total: { limit: number; remaining: number };
    byAsset: {
      stock: { limit: number; remaining: number };
      crypto: { limit: number; remaining: number };
    };
  };
  selectionMeta: {
    now: number;
    cooldownCutoff: number;
  };
  messages: Array<{
    tier: Tier;
    asset: AssetClass;
    telegram: string;
    plain: string;
    compact: string;
    symbols: string[];
  }>;
};

type PersistedSignal = { id: number; record: SignalRecord };
const GLOBAL_DAILY_CAP = 2;

export async function runDailyOnce(): Promise<DailyRunResult> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startSec = Math.floor(startOfDay.getTime() / 1000);
  const totalSentRow = db.prepare(`
    SELECT COUNT(DISTINCT signal_id) as cnt
    FROM publish_queue
    WHERE sent_at IS NOT NULL AND sent_at >= ?
  `).get(startSec) as { cnt?: number } | undefined;
  const alreadySentTotal = totalSentRow?.cnt ?? 0;

  const [stockSignals, cryptoSignals] = await Promise.all([
    runStocksOnce(STOCK_UNIVERSE),
    runCryptoOnce(CRYPTO_UNIVERSE),
  ]);

  const candidates = [...stockSignals, ...cryptoSignals];
  const selection = selectDailySignals(candidates);

  const globalCap = Math.max(Math.min(POSTING_RULES.DAILY_POST_CAP, GLOBAL_DAILY_CAP) - alreadySentTotal, 0);
  const trimmed = enforceGlobalCap(selection.selected, globalCap);
  const finalSelected = trimmed.selected;

  const persisted: PersistedSignal[] = selection.selected.map(({ signal }) => ({
    id: upsertSignal(signal),
    record: signal,
  }));

  const finalPersisted = persisted.filter((entry) => finalSelected.some(({ signal }) => signal.uniq_key === entry.record.uniq_key));

  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const shouldDispatch = postEnabled && !dryRun;

  const groups = buildGroups(finalPersisted);
  const composed = composeGroups(groups);

  if (shouldDispatch) {
    enqueueGroups(composed);
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
    selected: finalSelected.map(({ signal, autoPass, flowUsd }) => ({
      symbol: signal.symbol,
      assetType: signal.asset_type,
      tier: signal.tier_min === 'elite' ? 'elite' : 'pro',
      score: signal.score,
      flowUsd,
      autoPass,
    })),
    rejected: [...selection.rejected, ...trimmed.overflow.map(({ signal }) => ({ signal, reason: 'no_capacity' as const }))]
      .map(({ signal, reason }) => ({
        symbol: signal.symbol,
        assetType: signal.asset_type,
        reason,
      })),
    capacity: selection.capacity,
    selectionMeta: selection.meta,
    messages: composed.map((group) => ({
      tier: group.tier,
      asset: group.asset,
      telegram: group.message.telegram,
      plain: group.message.plain,
      compact: group.message.compact,
      symbols: group.symbols,
    })),
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

function composeGroups(groups: Array<{ tier: Tier; asset: AssetClass; entries: PersistedSignal[] }>): Array<{
  tier: Tier;
  asset: AssetClass;
  entries: PersistedSignal[];
  message: FormattedMessage;
  symbols: string[];
}> {
  return groups.map((group) => {
    const bases = group.entries.map(({ record }) => buildMessageBase(record));
    const message = formatForTier(group.tier, group.asset, bases);
    const symbols = group.entries.map(({ record }) => record.symbol);
    return { ...group, message, symbols };
  });
}

function enqueueGroups(groups: Array<{
  tier: Tier;
  asset: AssetClass;
  entries: PersistedSignal[];
  message: FormattedMessage;
  symbols: string[];
}>) {
  const now = Math.floor(Date.now() / 1000);
  for (const group of groups) {
    const readyAt = group.tier === 'free'
      ? Math.max(
          ...group.entries.map(({ record }) => record.embargo_until ?? now + TIER_GATES.free.delaySeconds),
        )
      : now;

    const payload = JSON.stringify({
      version: 2,
      tier: group.tier,
      asset: group.asset,
      message: group.message,
      symbols: group.symbols,
    });

    group.entries.forEach(({ id }) => {
      queueStmt.run({
        signal_id: id,
        tier: group.tier,
        payload,
        ready_at: readyAt,
      });
    });
  }
}

function enforceGlobalCap(selected: SelectedSignal[], cap: number) {
  if (cap <= 0) {
    return { selected: [] as SelectedSignal[], overflow: selected };
  }

  const sorted = [...selected].sort((a, b) => b.signal.score - a.signal.score);
  const perAsset = {
    stock: sorted.filter((item) => item.signal.asset_type === 'stock'),
    crypto: sorted.filter((item) => item.signal.asset_type === 'crypto'),
  } as Record<AssetClass, SelectedSignal[]>;

  const chosen: SelectedSignal[] = [];
  const usedSymbols = new Set<string>();

  for (const asset of ['stock', 'crypto'] as const) {
    if (chosen.length >= cap) break;
    const candidate = perAsset[asset].find((item) => !usedSymbols.has(item.signal.symbol));
    if (candidate) {
      chosen.push(candidate);
      usedSymbols.add(candidate.signal.symbol);
    }
  }

  for (const item of sorted) {
    if (chosen.length >= cap) break;
    if (usedSymbols.has(item.signal.symbol)) continue;
    chosen.push(item);
    usedSymbols.add(item.signal.symbol);
  }

  const chosenSet = new Set(chosen.map((item) => item.signal.uniq_key));
  const overflow = selected.filter((item) => !chosenSet.has(item.signal.uniq_key));
  return { selected: chosen, overflow };
}
