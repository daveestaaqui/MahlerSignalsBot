type Base = { symbol:string; price?:number; pct?:number; rvol?:number; reason?:string; score:number; subs:any; tier:'free'|'pro'|'elite'; assetType:'stock'|'crypto' };
const emj = { elite:'👑', pro:'⭐', free:'⌛' } as const;
const pct = (n?:number)=> (n===undefined?'-' : `${(n*100).toFixed(1)}%`);
const price = (n?:number)=> (n===undefined?'-' : `$${n.toFixed(n>=10?2:n>=1?3:4)}`);
export function fmtEliteStock(m:Base){
  return `${emj.elite} ELITE • ${m.symbol}\nScore: ${(m.score*100).toFixed(0)}/100\nTech ${Math.round(m.subs.tech*40)}/40 | Whale ${Math.round(m.subs.whale*30)}/30 | Sent ${Math.round(m.subs.sentiment*20)}/20 | Opt ${Math.round(m.subs.options*10)}/10\nPlan: ${m.reason||'—'}\nPrice ${price(m.price)} | Δ ${pct(m.pct)} | RVOL ${m.rvol ?? '-'}\n⚠️ Not financial advice`;
}
export function fmtEliteCrypto(m:Base){
  return `${emj.elite} ELITE • ${m.symbol}\nScore: ${(m.score*100).toFixed(0)} | Conviction: ${m.reason||'—'}\nWhales/Sentiment breakdown: ${JSON.stringify(m.subs)}\nPrice ${price(m.price)} | Δ ${pct(m.pct)} | RVOL ${m.rvol ?? '-'}\n⚠️ Not financial advice`;
}
export function fmtPro(m:Base){
  return `${emj.pro} PRO • ${m.assetType.toUpperCase()} ${m.symbol}\nScore ${(m.score*100).toFixed(0)} | ${m.reason||'—'}\nPrice ${price(m.price)} | Δ ${pct(m.pct)} | RVOL ${m.rvol ?? '-'}\nUpgrade to ELITE for whale/alt/option coverage.`;
}
export function fmtFreeTeaser(m:Base){
  return `${emj.free} FREE (Delayed) • ${m.symbol}\nYesterday’s highlight. Upgrade for realtime + full plan.`;
}
