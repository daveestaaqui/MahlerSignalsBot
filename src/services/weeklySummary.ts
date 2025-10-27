import db from '../lib/db.js';

const LOOKBACK_SECONDS = 7 * 24 * 3600;

export type WeeklyStats = {
  generatedAt: string;
  totalSignals: number;
  countsByTier: Record<string, number>;
  wins: number;
  losses: number;
  averageScore: number;
  topMoves: string[];
  lines: string[];
};

export function generateWeeklySummary(): WeeklyStats {
  const since = Math.floor(Date.now()/1000) - LOOKBACK_SECONDS;
  const rows = db.prepare(`
    SELECT pq.tier, pq.sent_at, s.symbol, s.asset_type, s.score, s.features, m.entry_price, m.exit_price_1d, m.exit_price_3d
    FROM publish_queue pq
    JOIN signals s ON s.id = pq.signal_id
    LEFT JOIN signal_metrics m ON m.signal_id = pq.signal_id AND m.tier = pq.tier
    WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?
    ORDER BY pq.sent_at DESC
  `).all(since) as Array<{ tier:string; sent_at:number; symbol:string; asset_type:string; score:number; features:string; entry_price?:number; exit_price_1d?:number; exit_price_3d?:number }>; 

  const counts: Record<string, number> = {};
  let wins = 0;
  let losses = 0;
  let totalScore = 0;
  const moves: Array<{ symbol:string; tier:string; pnl:number }> = [];

  const lines = rows.map(row => {
    counts[row.tier] = (counts[row.tier] || 0) + 1;
    totalScore += row.score ?? 0;
    const features = safeParse(row.features);
    const entry = row.entry_price ?? features?.price ?? null;
    const exit = row.exit_price_3d ?? row.exit_price_1d ?? entry;
    const pnl = (entry && exit) ? (exit - entry) / entry : 0;
    if(pnl > 0) wins++; else if(pnl < 0) losses++;
    moves.push({ symbol: row.symbol, tier: row.tier, pnl });
    const ts = new Date(row.sent_at * 1000).toISOString().slice(0,19);
    return `[${row.tier.toUpperCase()}] ${row.symbol} (${row.asset_type}) • score ${(row.score*100).toFixed(0)} • sent ${ts} • est P/L ${(pnl*100).toFixed(1)}%`;
  });

  moves.sort((a,b)=> Math.abs(b.pnl) - Math.abs(a.pnl));
  const topMoves = moves.slice(0,3).map(m => `${m.symbol} (${m.tier}) ${(m.pnl*100).toFixed(1)}%`);

  return {
    generatedAt: new Date().toISOString(),
    totalSignals: rows.length,
    countsByTier: counts,
    wins,
    losses,
    averageScore: rows.length ? +(totalScore/rows.length).toFixed(2) : 0,
    topMoves,
    lines,
  };
}

function safeParse(raw?:string){
  if(!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}
