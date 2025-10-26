import db from '../lib/db.js';

export type WeeklySummary = {
  generatedAt: string;
  count: number;
  byTier: Record<string, number>;
  lines: string[];
};

const SEVEN_DAYS = 7*24*3600;

export function generateWeeklySummary(): WeeklySummary {
  const since = Math.floor(Date.now()/1000) - SEVEN_DAYS;
  const rows = db.prepare(`
    SELECT pq.tier, pq.sent_at, s.symbol, s.asset_type, s.score, s.reason
    FROM publish_queue pq JOIN signals s ON s.id=pq.signal_id
    WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?
    ORDER BY pq.sent_at DESC
  `).all(since) as Array<{tier:string; sent_at:number; symbol:string; asset_type:string; score:number; reason:string}>;
  const byTier: Record<string, number> = {};
  const lines = rows.map(row => {
    byTier[row.tier] = (byTier[row.tier] || 0) + 1;
    const scorePct = typeof row.score === 'number' ? Math.round(row.score*100) : 'n/a';
    const ts = new Date((row.sent_at||0)*1000).toISOString().slice(0,19);
    return `[${row.tier.toUpperCase()}] ${row.symbol} (${row.asset_type}) — score ${scorePct} • ${row.reason} • sent ${ts}`;
  });
  return {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    byTier,
    lines,
  };
}
