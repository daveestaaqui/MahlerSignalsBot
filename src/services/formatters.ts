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

const disclaimer = '⚠️ Not financial advice • https://aurora-signals.onrender.com';

export function eliteStockMessage(m:MessageBase){
  const subs = m.subs || {};
  return [
    `${emoji.elite} ELITE • ${m.symbol}`,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'Elite conviction setup'}`,
    `Breakdown: Tech ${Math.round((subs.tech ?? 0)*100)} | Whale ${Math.round((subs.whale ?? 0)*100)} | Sent ${Math.round((subs.sentiment ?? 0)*100)} | Opt ${Math.round((subs.options ?? 0)*100)} | Fund ${Math.round((subs.fundamental ?? 0)*100)}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    `Plan: Review entry/target in Elite channel.`,
    disclaimer,
  ].join('\n');
}

export function eliteCryptoMessage(m:MessageBase){
  const subs = m.subs || {};
  return [
    `${emoji.elite} ELITE • ${m.symbol} (Crypto)`,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'Whale accumulation + momentum'}`,
    `Breakdown: Tech ${Math.round((subs.tech ?? 0)*100)} | Whale ${Math.round((subs.whale ?? 0)*100)} | Sent ${Math.round((subs.sentiment ?? 0)*100)} | Fund ${Math.round((subs.fundamental ?? 0)*100)}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    `Plan: Scale using staged entries, manage risk 1R.`,
    disclaimer,
  ].join('\n');
}

export function proMessage(m:MessageBase){
  return [
    `${emoji.pro} PRO • ${m.symbol} (${m.assetType})` ,
    `Score ${(m.score*100).toFixed(0)} — ${m.reason || 'High conviction signal'}`,
    `Price ${priceFmt(m.price)} • Δ ${pctFmt(m.pct)} • RVOL ${m.rvol?.toFixed(2) ?? '—'}`,
    'Upgrade to ELITE for advanced catalysts & options flow.',
    disclaimer,
  ].join('\n');
}

export function freeTeaser(m:MessageBase){
  return [
    `${emoji.free} FREE (Delayed) • ${m.symbol}`,
    `Yesterday’s highlight. Upgrade for realtime plan + entries.`,
    disclaimer,
  ].join('\n');
}
