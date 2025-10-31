import db from '../lib/db.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { selectDailySignals, type SelectedSignal } from '../services/selector.js';
import { canPublish } from '../services/gating.js';
import {
  fmtEliteStock,
  fmtEliteCrypto,
  fmtPro,
  fmtFreeTeaser,
  type MessageBase,
  type FormattedMessage,
} from '../services/formatters.js';
import { TIER_GATES } from '../config/tiers.js';
import type { SignalRecord } from '../signals/rules.js';
import { CADENCE, todayIso } from '../config/cadence.js';
import { POSTING_RULES } from '../config/posting.js';
import { getLedgerCounts, incrementLedger } from '../lib/publishLedger.js';

const envBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return fallback;
};

type Tier = 'elite' | 'pro' | 'free';
type AssetClass = 'stock' | 'crypto';

type ProviderIssue = {
  provider: string;
  message: string;
  retryInSec: number;
};

type TelemetryPhase = 'fetch' | 'score' | 'gate' | 'format' | 'dispatch';
type TelemetryEvent = {
  ts: string;
  phase: TelemetryPhase;
  asset?: AssetClass;
  tier?: Tier;
  symbol?: string;
  score?: number;
  channel?: string;
  status?: string;
  reason?: string;
  error?: string;
};

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
  preview: boolean;
  cadence: {
    date: string;
    limits: {
      total: number;
      byAsset: Record<AssetClass, number>;
    };
    before: Record<AssetClass, number>;
    after: Record<AssetClass, number>;
  };
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
  posted: number;
  reason?: string;
  providerErrors: ProviderIssue[];
  telemetry: TelemetryEvent[];
  errors: ProviderIssue[];
  dispatch: Array<{ tier: Tier; asset: AssetClass; symbols: string[]; queued: boolean }>;
};

type PersistedSignal = { id: number; record: SignalRecord };
const DEFAULT_ASSETS: AssetClass[] = ['stock', 'crypto'];
const PER_ASSET_CAP = 2;
const MIN_DISPATCH_SCORE = Math.max(POSTING_RULES.MIN_SCORE_PRO, 0.85);

export type RunDailyOptions = {
  assets?: AssetClass[];
  preview?: boolean;
  minScore?: number;
  limit?: number;
};

export async function runDailyOnce(options: RunDailyOptions = {}): Promise<DailyRunResult> {
  const preview = options.preview ?? false;
  const providerErrors: ProviderIssue[] = [];
  const telemetry: TelemetryEvent[] = [];

  const logPhase = (event: Omit<TelemetryEvent, 'ts'>) => {
    const payload: TelemetryEvent = { ts: new Date().toISOString(), ...event };
    telemetry.push(payload);
    console.log(JSON.stringify(payload));
  };

  const ledgerDate = todayIso();
  const ledgerCounts = getLedgerCounts(ledgerDate);

  const assetCaps: Record<AssetClass, number> = {
    stock: CADENCE.ENABLE_STOCKS_DAILY ? PER_ASSET_CAP : 0,
    crypto: CADENCE.ENABLE_CRYPTO_DAILY ? PER_ASSET_CAP : 0,
  };

  const requestedAssets = normalizeAssets(options.assets ?? DEFAULT_ASSETS);
  const assetsToRun = requestedAssets.filter((asset) => assetCaps[asset] > 0);

  const globalCapTarget = assetsToRun.length * PER_ASSET_CAP;
  const maxDaily = Number.isFinite(CADENCE.MAX_POSTS_PER_DAY) && CADENCE.MAX_POSTS_PER_DAY > 0 ? CADENCE.MAX_POSTS_PER_DAY : globalCapTarget;
  const globalLimit = Math.min(globalCapTarget, maxDaily);
  const globalRemainingBefore = Math.max(globalLimit - (ledgerCounts.stock + ledgerCounts.crypto), 0);

  const shouldRunStocks = assetsToRun.includes('stock');
  const shouldRunCrypto = assetsToRun.includes('crypto');

  const stockSignals = await safeFetchSignals('stock', shouldRunStocks, () => runStocksOnce(STOCK_UNIVERSE), providerErrors, logPhase);
  const cryptoSignals = await safeFetchSignals('crypto', shouldRunCrypto, () => runCryptoOnce(CRYPTO_UNIVERSE), providerErrors, logPhase);

  const candidates = [...stockSignals, ...cryptoSignals];
  candidates.forEach((candidate) => {
    logPhase({ phase: 'score', asset: candidate.asset_type, symbol: candidate.symbol, score: candidate.score });
  });
  const selection = selectDailySignals(candidates);

  const remainingByAsset: Record<AssetClass, number> = {
    stock: clampRemaining(assetCaps.stock - ledgerCounts.stock, globalRemainingBefore),
    crypto: clampRemaining(assetCaps.crypto - ledgerCounts.crypto, globalRemainingBefore),
  };

  const minScoreOverride =
    typeof options.minScore === 'number' && Number.isFinite(options.minScore)
      ? options.minScore
      : MIN_DISPATCH_SCORE;

  const cadenceTrimmed = enforceCadence(selection.selected, remainingByAsset, globalRemainingBefore);
  const [selectedAboveThreshold, lowScoreOverflow] = partitionByScore(cadenceTrimmed.selected, minScoreOverride);

  let finalSelected = selectedAboveThreshold;
  let trimmedOverflow: SelectedSignal[] = [];
  if (
    preview &&
    typeof options.limit === 'number' &&
    Number.isFinite(options.limit) &&
    options.limit >= 0 &&
    finalSelected.length > options.limit
  ) {
    const limit = Math.max(0, Math.floor(options.limit));
    trimmedOverflow = finalSelected.slice(limit);
    finalSelected = finalSelected.slice(0, limit);
  }

  const overflow = [...cadenceTrimmed.overflow, ...lowScoreOverflow, ...trimmedOverflow];
  const lowScoreSet = new Set(lowScoreOverflow.map((item) => item.signal.uniq_key));

  selection.rejected.forEach(({ signal, reason }) => {
    logPhase({ phase: 'gate', asset: signal.asset_type, symbol: signal.symbol, score: signal.score, reason });
  });
  overflow.forEach(({ signal }) => {
    const reason = lowScoreSet.has(signal.uniq_key) ? 'score_below_threshold' : 'no_capacity';
    logPhase({ phase: 'gate', asset: signal.asset_type, symbol: signal.symbol, score: signal.score, reason });
  });

  const persisted: PersistedSignal[] = finalSelected.map(({ signal }, idx) => ({
    id: preview ? -(idx + 1) : upsertSignal(signal),
    record: signal,
  }));

  const dryRun = envBool(process.env.DRY_RUN, false);
  const postEnabled = envBool(process.env.POST_ENABLED, true);
  const shouldDispatch = !preview && postEnabled && !dryRun && finalSelected.length > 0;

  const groups = buildGroups(persisted);
  const composed = composeGroups(groups);

  if (shouldDispatch) {
    enqueueGroups(composed);
    recordCadenceUsage(finalSelected, ledgerDate);
  }

  const countsUsed = countByAsset(finalSelected);
  const totalUsed = countsUsed.stock + countsUsed.crypto;

  const posted = shouldDispatch ? totalUsed : 0;
  let reason: string | undefined;
  if (finalSelected.length === 0) {
    reason = 'no_candidates_after_gating';
  }
  if (preview) {
    reason = reason ?? 'preview';
  }
  if (!shouldDispatch && !preview && finalSelected.length > 0) {
    reason = reason ?? (dryRun ? 'dry_run' : postEnabled ? 'queue_disabled' : 'post_disabled');
  }
  if (providerErrors.length && posted === 0) {
    reason = reason ?? 'upstream_errors';
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    postEnabled,
    preview,
    posted,
    reason,
    providerErrors,
    errors: providerErrors,
    telemetry,
    cadence: {
      date: ledgerDate,
      limits: {
        total: globalLimit,
        byAsset: assetCaps,
      },
      before: {
        stock: ledgerCounts.stock,
        crypto: ledgerCounts.crypto,
      },
      after: {
        stock: ledgerCounts.stock + (shouldDispatch ? countsUsed.stock : 0),
        crypto: ledgerCounts.crypto + (shouldDispatch ? countsUsed.crypto : 0),
      },
    },
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
    rejected: [
      ...selection.rejected,
      ...overflow.map(({ signal }) => ({
        signal,
        reason: lowScoreSet.has(signal.uniq_key) ? ('score_below_threshold' as const) : ('no_capacity' as const),
      })),
    ].map(({ signal, reason }) => ({
      symbol: signal.symbol,
      assetType: signal.asset_type,
      reason,
    })),
    capacity: {
      total: {
        limit: globalLimit,
        remaining: Math.max(globalRemainingBefore - totalUsed, 0),
      },
      byAsset: {
        stock: {
          limit: assetCaps.stock,
          remaining: Math.max(remainingByAsset.stock - countsUsed.stock, 0),
        },
        crypto: {
          limit: assetCaps.crypto,
          remaining: Math.max(remainingByAsset.crypto - countsUsed.crypto, 0),
        },
      },
    },
    selectionMeta: selection.meta,
    messages: composed.map((group) => ({
      tier: group.tier,
      asset: group.asset,
      telegram: group.message.telegram,
      plain: group.message.plain,
      compact: group.message.compact,
      symbols: group.symbols,
    })),
    dispatch: composed.map((group) => ({
      tier: group.tier,
      asset: group.asset,
      symbols: group.symbols,
      queued: shouldDispatch,
    })),
  };
}

function normalizeAssets(assets: AssetClass[]): AssetClass[] {
  const normalized = new Set<AssetClass>();
  for (const asset of assets) {
    if (asset === 'stock' || asset === 'crypto') {
      normalized.add(asset);
    }
  }
  return Array.from(normalized);
}

async function safeFetchSignals(
  asset: AssetClass,
  shouldRun: boolean,
  loader: () => Promise<SignalRecord[]>,
  providerErrors: ProviderIssue[],
  logPhase: (event: Omit<TelemetryEvent, 'ts'>) => void,
): Promise<SignalRecord[]> {
  if (!shouldRun) return [];
  try {
    const records = await loader();
    records.forEach((record) => {
      logPhase({ phase: 'fetch', asset, symbol: record.symbol, score: record.score });
    });
    return records;
  } catch (err) {
    const message = formatError(err);
    providerErrors.push({ provider: asset, message, retryInSec: 60 });
    logPhase({ phase: 'fetch', asset, error: message, status: 'degraded' });
    return [];
  }
}

function clampRemaining(remaining: number, globalRemaining: number): number {
  if (remaining <= 0 || globalRemaining <= 0) {
    return 0;
  }
  return Math.max(Math.min(remaining, globalRemaining), 0);
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
      symbol: record.symbol,
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
    extras: {
      support: signal.features?.support,
      resistance: signal.features?.resistance,
      timeframe: signal.features?.timeframe ?? signal.features?.cycle,
      riskNote: signal.features?.riskNote,
    },
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

function averageScore(entries: PersistedSignal[]): number {
  if (!entries.length) return 0;
  const total = entries.reduce((acc, entry) => acc + entry.record.score, 0);
  return Number((total / entries.length).toFixed(3));
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
    const readyAt =
      group.tier === 'free'
        ? Math.max(
            ...group.entries.map(({ record }) => record.embargo_until ?? now + TIER_GATES.free.delaySeconds),
          )
        : now;

    const payload = JSON.stringify({
      version: 3,
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

function enforceCadence(
  selected: SelectedSignal[],
  remainingByAsset: Record<AssetClass, number>,
  globalRemaining: number,
) {
  if (globalRemaining <= 0) {
    return { selected: [] as SelectedSignal[], overflow: selected };
  }

  const sorted = [...selected].sort((a, b) => b.signal.score - a.signal.score);
  const chosen: SelectedSignal[] = [];
  const overflow: SelectedSignal[] = [];
  const counts: Record<AssetClass, number> = { stock: 0, crypto: 0 };
  const usedSymbols = new Set<string>();

  for (const entry of sorted) {
    const asset = entry.signal.asset_type;
    if (usedSymbols.has(entry.signal.symbol)) {
      overflow.push(entry);
      continue;
    }
    if (counts[asset] >= remainingByAsset[asset]) {
      overflow.push(entry);
      continue;
    }
    if (chosen.length >= globalRemaining) {
      overflow.push(entry);
      continue;
    }
    chosen.push(entry);
    counts[asset] += 1;
    usedSymbols.add(entry.signal.symbol);
  }

  return { selected: chosen, overflow };
}

function countByAsset(selected: SelectedSignal[]): Record<AssetClass, number> {
  return selected.reduce(
    (acc, item) => {
      acc[item.signal.asset_type] += 1;
      return acc;
    },
    { stock: 0, crypto: 0 } as Record<AssetClass, number>,
  );
}

function recordCadenceUsage(selected: SelectedSignal[], ledgerDate: string) {
  const counts = countByAsset(selected);
  if (counts.stock > 0) {
    incrementLedger('stock', counts.stock, ledgerDate);
  }
  if (counts.crypto > 0) {
    incrementLedger('crypto', counts.crypto, ledgerDate);
  }
}

function partitionByScore(selected: SelectedSignal[], minScore: number): [SelectedSignal[], SelectedSignal[]] {
  const passed: SelectedSignal[] = [];
  const failed: SelectedSignal[] = [];
  for (const entry of selected) {
    const score = entry.signal.score;
    if (Number.isFinite(score) && score >= minScore) {
      passed.push(entry);
    } else {
      failed.push(entry);
    }
  }
  return [passed, failed];
}

function formatError(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return 'unknown-error';
  }
}
