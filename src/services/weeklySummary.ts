import db from '../lib/db.js';

const LOOKBACK_SECONDS = 5 * 24 * 3600;

export type WeeklySummary = {
  count: number;
  avgScore: number | null;
  medianScore: number | null;
  winRate5d: number | null;
  topWinners: Array<{ symbol: string; tier: string; pnl: number }>;
  topLosers: Array<{ symbol: string; tier: string; pnl: number }>;
  entries: Array<{ ticker: string; score?: number; pnl5d?: number }>;
};

export function generateWeeklySummary(): WeeklySummary {
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - LOOKBACK_SECONDS;
  const rows = db.prepare(`
    SELECT pq.tier, pq.sent_at, s.symbol, s.score, s.features,
           m.entry_price, m.exit_price_1d, m.exit_price_3d
    FROM publish_queue pq
    JOIN signals s ON s.id = pq.signal_id
    LEFT JOIN signal_metrics m ON m.signal_id = pq.signal_id AND m.tier = pq.tier
    WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?
  `).all(since) as Array<{
    tier: string;
    sent_at: number;
    symbol: string;
    score: number;
    features?: string;
    entry_price?: number;
    exit_price_1d?: number;
    exit_price_3d?: number;
  }>;

  if (!rows.length) {
    return {
      count: 0,
      avgScore: null,
      medianScore: null,
      winRate5d: null,
      topWinners: [],
      topLosers: [],
      entries: [],
    };
  }

  const scores: number[] = [];
  const pnlSamples: Array<{ symbol: string; tier: string; pnl: number }> = [];
  let wins = 0;
  const timeline = new Map<string, { ticker: string; score?: number; pnl5d?: number; sentAt: number }>();

  rows.forEach((row) => {
    scores.push(row.score);
    const features = safeParse(row.features);
    const entry = row.entry_price ?? features?.price ?? null;
    const exit = row.exit_price_3d ?? row.exit_price_1d ?? entry;
    const pnl = entry && exit ? (exit - entry) / entry : 0;
    if (pnl > 0) wins++;
    pnlSamples.push({ symbol: row.symbol, tier: row.tier, pnl });

    const pnl5d =
      typeof features?.pnl5d === 'number'
        ? features.pnl5d
        : typeof features?.pnl_5d === 'number'
          ? features.pnl_5d
          : pnl;
    timeline.set(`${row.symbol}:${row.tier}`, {
      ticker: row.symbol,
      score: +row.score.toFixed(3),
      pnl5d: Number.isFinite(pnl5d) ? +pnl5d.toFixed(4) : undefined,
      sentAt: row.sent_at ?? nowSec,
    });
  });

  const avgScore = average(scores);
  const medScore = median(scores);
  const winRate = rows.length ? wins / rows.length : null;

  pnlSamples.sort((a, b) => b.pnl - a.pnl);
  const topWinners = pnlSamples.filter((p) => p.pnl > 0).slice(0, 5);
  const topLosers = pnlSamples
    .filter((p) => p.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)
    .slice(0, 5);

  const entries = Array.from(timeline.values())
    .sort((a, b) => b.sentAt - a.sentAt)
    .map(({ sentAt, ...rest }) => rest);

  return {
    count: rows.length,
    avgScore: avgScore !== null ? +avgScore.toFixed(3) : null,
    medianScore: medScore !== null ? +medScore.toFixed(3) : null,
    winRate5d: winRate !== null ? +winRate.toFixed(3) : null,
    topWinners,
    topLosers,
    entries,
  };
}

function safeParse(raw?: string) {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
