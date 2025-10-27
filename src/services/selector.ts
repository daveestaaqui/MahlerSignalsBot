import db from '../lib/db.js';
import { POSTING_RULES } from '../config/posting.js';
import type { SignalRecord } from '../signals/rules.js';

type AssetClass = 'stock' | 'crypto';

export type SelectedSignal = {
  signal: SignalRecord;
  autoPass: boolean;
  flowUsd: number;
};

export type RejectedSignal = {
  signal: SignalRecord;
  reason: 'score_below_threshold' | 'cooldown' | 'no_capacity';
};

export type SelectionResult = {
  selected: SelectedSignal[];
  rejected: RejectedSignal[];
  capacity: Record<AssetClass, { limit: number; remaining: number }>;
  meta: {
    now: number;
    cooldownCutoff: number;
  };
};

const LAST_SENT_SQL = `
  SELECT s.symbol, s.asset_type, MAX(pq.sent_at) as last_sent
  FROM publish_queue pq
  JOIN signals s ON s.id = pq.signal_id
  WHERE pq.sent_at IS NOT NULL
  GROUP BY s.symbol, s.asset_type
`;

const POSTED_TODAY_SQL = `
  SELECT s.asset_type, COUNT(DISTINCT pq.signal_id) as cnt
  FROM publish_queue pq
  JOIN signals s ON s.id = pq.signal_id
  WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?
  GROUP BY s.asset_type
`;

type LastSentRow = { symbol: string; asset_type: AssetClass; last_sent: number | null };
type PostedTodayRow = { asset_type: AssetClass; cnt: number };

export function selectDailySignals(candidates: SignalRecord[], now = Date.now()): SelectionResult {
  const nowSec = Math.floor(now / 1000);
  const cooldownCutoff = nowSec - POSTING_RULES.COOLDOWN_SECONDS;

  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const startOfDaySec = Math.floor(start.getTime() / 1000);

  const lastSentRows = db.prepare(LAST_SENT_SQL).all() as LastSentRow[];
  const lastSentMap = new Map<string, number>();
  for (const row of lastSentRows) {
    if (row.last_sent) {
      lastSentMap.set(`${row.asset_type}:${row.symbol}`, row.last_sent);
    }
  }

  const postedRows = db.prepare(POSTED_TODAY_SQL).all(startOfDaySec) as PostedTodayRow[];
  const postedCounts: Record<AssetClass, number> = { stock: 0, crypto: 0 };
  for (const row of postedRows) {
    postedCounts[row.asset_type] = row.cnt ?? 0;
  }

  const limits: Record<AssetClass, number> = {
    stock: Math.max(POSTING_RULES.DAILY_POST_CAP - postedCounts.stock, 0),
    crypto: Math.max(POSTING_RULES.DAILY_POST_CAP - postedCounts.crypto, 0),
  };

  type Eligible = SelectedSignal & { reason?: RejectedSignal['reason'] };
  const eligibleByAsset: Record<AssetClass, { autopass: Eligible[]; regular: Eligible[] }> = {
    stock: { autopass: [], regular: [] },
    crypto: { autopass: [], regular: [] },
  };
  const rejected: RejectedSignal[] = [];

  for (const signal of candidates) {
    const asset = signal.asset_type;
    const key = `${asset}:${signal.symbol}`;
    const lastSent = lastSentMap.get(key);
    if (lastSent && lastSent >= cooldownCutoff) {
      rejected.push({ signal, reason: 'cooldown' });
      continue;
    }

    const requiredScore =
      signal.tier_min === 'elite'
        ? POSTING_RULES.MIN_SCORE_ELITE
        : POSTING_RULES.MIN_SCORE_PRO;

    const flowUsd = extractFlowUsd(signal.features ?? {});
    const autoPass = flowUsd >= POSTING_RULES.FLOW_USD_MIN;
    const meetsScore = signal.score >= requiredScore;

    if (!autoPass && !meetsScore) {
      rejected.push({ signal, reason: 'score_below_threshold' });
      continue;
    }

    const entry: Eligible = { signal, autoPass, flowUsd };
    if (autoPass) {
      eligibleByAsset[asset].autopass.push(entry);
    } else {
      eligibleByAsset[asset].regular.push(entry);
    }
  }

  const sortByScore = (a: Eligible, b: Eligible) => b.signal.score - a.signal.score;
  eligibleByAsset.stock.autopass.sort(sortByScore);
  eligibleByAsset.stock.regular.sort(sortByScore);
  eligibleByAsset.crypto.autopass.sort(sortByScore);
  eligibleByAsset.crypto.regular.sort(sortByScore);

  const selected: SelectedSignal[] = [];
  const counts: Record<AssetClass, number> = { stock: 0, crypto: 0 };

  const assets: AssetClass[] = ['stock', 'crypto'];

  const pickFrom = (asset: AssetClass) => {
    const pools = eligibleByAsset[asset];
    const pool = pools.autopass.length ? pools.autopass : pools.regular;
    if (!pool.length) return undefined;
    const entry = pool.shift()!;
    selected.push({ signal: entry.signal, autoPass: entry.autoPass, flowUsd: entry.flowUsd });
    counts[asset] += 1;
    return entry;
  };

  while (true) {
    const available = assets.filter(asset => {
      if (counts[asset] >= limits[asset]) return false;
      const pools = eligibleByAsset[asset];
      return pools.autopass.length > 0 || pools.regular.length > 0;
    });
    if (!available.length) break;
    available.sort((a, b) => {
      const countDiff = counts[a] - counts[b];
      if (countDiff !== 0) return countDiff;
      const topA = eligibleByAsset[a].autopass[0] ?? eligibleByAsset[a].regular[0];
      const topB = eligibleByAsset[b].autopass[0] ?? eligibleByAsset[b].regular[0];
      const scoreA = topA ? topA.signal.score : -Infinity;
      const scoreB = topB ? topB.signal.score : -Infinity;
      return scoreB - scoreA;
    });
    pickFrom(available[0]);
  }

  for (const asset of assets) {
    const pools = eligibleByAsset[asset];
    const remaining = [...pools.autopass, ...pools.regular];
    for (const entry of remaining) {
      rejected.push({ signal: entry.signal, reason: 'no_capacity' });
    }
  }

  return {
    selected,
    rejected,
    capacity: {
      stock: { limit: POSTING_RULES.DAILY_POST_CAP, remaining: Math.max(limits.stock - counts.stock, 0) },
      crypto: { limit: POSTING_RULES.DAILY_POST_CAP, remaining: Math.max(limits.crypto - counts.crypto, 0) },
    },
    meta: {
      now: nowSec,
      cooldownCutoff,
    },
  };
}

function extractFlowUsd(features: Record<string, unknown>): number {
  const keys = ['flowUsd', 'flow_usd', 'flowUSD', 'notionalUsd', 'whaleUsd'];
  let max = 0;
  for (const key of keys) {
    const value = features[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return max;
}
