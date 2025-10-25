type Num = number | undefined | null;
const pct = (v: Num) => (typeof v === 'number' ? `${(v*100).toFixed(1)}%` : '—');
const n2  = (v: Num) => (typeof v === 'number' ? v.toFixed(2) : '—');
const n1  = (v: Num) => (typeof v === 'number' ? v.toFixed(1) : '—');

export function normalizeSymbol(raw: string) {
  // Remove chain/pool suffixes like "SOL:CCC", "ETH:BBB" → "SOL", "ETH"
  if (!raw) return raw;
  const s = String(raw).toUpperCase();
  return s.includes(':') ? s.split(':')[0] : s;
}

export function eliteCryptoMessage(sig: any) {
  const sym = normalizeSymbol(sig.symbol);
  const f   = sig.features || {};
  const lines = [
    `👑 <b>ELITE</b> • <code>${sym}</code>`,
    `Score: <b>${n2(sig.score)}</b>`,
    `Flow: vol≈${(f.volumeUSD24h? Math.round(f.volumeUSD24h).toLocaleString() : '—')} | whales=${f.whaleScore ?? '—'} | mo=${n1(f.momentumScore)}`,
    f.catalysts?.length ? `Catalyst: ${f.catalysts[0]}` : null,
    `Plan: <i>entry on strength / pullback to prior H1 demand</i> • <i>risk 0.5–1.0R</i>`,
    `⚠️ Not financial advice • https://aurora-signals.onrender.com`
  ].filter(Boolean);
  return lines.join('\n');
}

export function eliteStockMessage(sig: any) {
  const sym = normalizeSymbol(sig.symbol);
  const f   = sig.features || {};
  const lines = [
    `👑 <b>ELITE STOCK</b> • <code>${sym}</code>`,
    `Score: <b>${n2(sig.score)}</b> • ${sig.reason}`,
    `Stats: Δ20d ${n1(f.pct_from_20d)}% • Δ200d ${n1(f.pct_from_200d)}% • RVOL ${n2(f.rvol)}`,
    `Smart-money ${((f.smartMoneyScore ?? 0)*100).toFixed(1)}% • Policy ${((f.policyTailwind ?? 0)*100).toFixed(1)}% • Sentiment ${((f.sentiment ?? 0)*100).toFixed(1)}%`,
    `Plan: <i>scale in on confirmation; invalidate on loss of prior day low</i>`,
    `⚠️ Not financial advice • https://aurora-signals.onrender.com`
  ];
  return lines.join('\n');
}

export function proStockMessage(sig: any) {
  const sym = normalizeSymbol(sig.symbol);
  const f   = sig.features || {};
  const lines = [
    `⭐ <b>PRO</b> • <code>${sym}</code>`,
    `Score: <b>${n2(sig.score)}</b> • ${sig.reason}`,
    `Δ20d ${n1(f.pct_from_20d)}% • Δ200d ${n1(f.pct_from_200d)}% • RVOL ${n2(f.rvol)} • Sent ${((f.sentiment ?? 0)*100).toFixed(1)}%`,
    `Plan: <i>intraday R:R setup; review premarket levels</i>`,
  ];
  return lines.join('\n');
}

export function freeTeaser(sig: any) {
  const sym = normalizeSymbol(sig.symbol);
  return `⌛ <b>${sym}</b> fired yesterday • Upgrade for realtime: https://aurora-signals.onrender.com#pricing`;
}
