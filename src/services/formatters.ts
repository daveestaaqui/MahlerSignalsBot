export type MessageBase = {
  symbol: string;
  price?: number;
  pct?: number;
  rvol?: number;
  reason?: string;
  score: number;
  subs?: Record<string, number>;
  assetType: 'stock'|'crypto';
};

const emoji = { elite:'👑', pro:'⭐', free:'⌛' } as const;
const pctFmt = (n?:number)=> (typeof n === 'number' ? `${(n*100).toFixed(1)}%` : '—');
const priceFmt = (n?:number)=> (typeof n === 'number' ? `$${n.toFixed(n>=10?2:n>=1?3:4)}` : '—');

export function eliteStockMessage(m:MessageBase){
  const subs = m.subs || {};
  return [
    `${emoji.elite} ELITE • ${m.symbol}`,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'Elite conviction setup'}`,
    `Breakdown: Tech ${Math.round((subs.tech ?? 0)*100)} | Whale ${Math.round((subs.whale ?? 0)*100)} | Sent ${Math.round((subs.sentiment ?? 0)*100)} | Opt ${Math.round((subs.options ?? 0)*100)} | Fund ${Math.round((subs.fundamental ?? 0)*100)}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    `Why now: Flow + trend aligned; monitor open drive.`,
    `Risk: Cap size ≤1.0R using plan stop.`,
  ].join('\n');
}

export function eliteCryptoMessage(m:MessageBase){
  const subs = m.subs || {};
  return [
    `${emoji.elite} ELITE • ${m.symbol} (Crypto)`,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'Whale accumulation + momentum'}`,
    `Breakdown: Tech ${Math.round((subs.tech ?? 0)*100)} | Whale ${Math.round((subs.whale ?? 0)*100)} | Sent ${Math.round((subs.sentiment ?? 0)*100)} | Fund ${Math.round((subs.fundamental ?? 0)*100)}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    `Why now: On-chain flow suggests expansion; use staggered entries.`,
    `Risk: Manage ≤1R with staggered fills around VWAP.`,
  ].join('\n');
}

export function proMessage(m:MessageBase){
  return [
    `${emoji.pro} PRO • ${m.symbol} (${m.assetType})`,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'High conviction signal'}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    `Why now: Momentum + flow aligned.`,
    `Risk: Size ≤0.75R; respect recent swing low.`,
  ].join('\n');
}

export function freeTeaser(m:MessageBase){
  return [
    `${emoji.free} FREE (Delayed) • ${m.symbol}`,
    `Highlights lag by 24h. Upgrade for realtime plan + entries.`,
  ].join('\n');
}
