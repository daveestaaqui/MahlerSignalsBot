import db from '../lib/db.js';

const LOOKBACK_SECONDS = 7 * 24 * 3600;

export type WeeklyStats = {
  generatedAt: string;
  totalSignals: number;
  countsByTier: Record<string, number>;
  profitable?: number;
  averageReturn?: number;
  lines: string[];
};

export function generateWeeklySummary(): WeeklyStats {
  const since = Math.floor(Date.now()/1000) - LOOKBACK_SECONDS;
  const rows = db.prepare(`
    SELECT pq.tier, pq.sent_at, s.symbol, s.asset_type, s.score, s.features
    FROM publish_queue pq
    JOIN signals s ON s.id = pq.signal_id
    WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?
    ORDER BY pq.sent_at DESC
  `).all(since) as Array<{tier:string; sent_at:number; symbol:string; asset_type:string; score:number; features:string}>;

  const counts: Record<string, number> = {};
  const lines: string[] = rows.map(row => {
    counts[row.tier] = (counts[row.tier] || 0) + 1;
    const ts = new Date(row.sent_at * 1000).toISOString().slice(0,19);
    const scorePct = Math.round((row.score ?? 0) * 100);
    return `[${row.tier.toUpperCase()}] ${row.symbol} (${row.asset_type}) — score ${scorePct} • sent ${ts}`;
  });

  // Placeholder win/loss metrics until PnL tracking is wired
  const placeholderReturn = rows.length ? +(rows.reduce((sum, row)=>sum + (row.score ?? 0), 0) / rows.length).toFixed(2) : undefined;

  return {
    generatedAt: new Date().toISOString(),
    totalSignals: rows.length,
    countsByTier: counts,
    profitable: undefined,
    averageReturn: placeholderReturn,
    lines,
  };
}
