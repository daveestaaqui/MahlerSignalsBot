import { getCryptoDaily, getWhaleEvents } from '../../adapters/crypto.js';
import { sma, rvol } from '../../lib/indicators.js';
import { score } from '../../signals/scoring.js';
import { stockUniq, type SignalRecord } from '../../signals/rules.js';
import { TIER_GATES } from '../../config/tiers.js';

const MIN_TOTAL = 0.65;
function clamp(n:number){ return Math.max(0, Math.min(1,n)); }

export async function runCryptoOnce(symbols:string[]): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now()/1000);
  const outputs: SignalRecord[] = [];
  for(const raw of symbols){
    const symbol = raw.toUpperCase();
    const candles = await getCryptoDaily(symbol).catch(()=>[]);
    if(!candles || candles.length < 60) continue;
    const sorted = [...candles].sort((a,b)=>a.t-b.t);
    const closes = sorted.map(c=>c.c);
    const vols = sorted.map(c=>c.v);
    const last = sorted[sorted.length-1];
    const prev = sorted[sorted.length-2];
    const sma20 = sma(closes,20) ?? last.c;
    const sma50 = sma(closes,50) ?? sma20;
    const relVol = rvol(vols,20) ?? 1;
    const change1d = (last.c - prev.c) / prev.c;
    const pct20 = (last.c - sma20)/sma20;
    const pct50 = (last.c - sma50)/sma50;

    const whales = await getWhaleEvents(symbol).catch(()=>[]);
    const whaleScore = clamp((whales.length)/5 + (change1d>0 ? 0.15 : 0));
    const techScore = clamp(0.55 + pct20/0.2 + change1d/0.1);
    const sentimentScore = clamp(0.5 + change1d/0.12);
    const fundamentalScore = clamp(0.5 + pct50/0.3);

    const total = score({ assetType:'crypto', tech:techScore, whale:whaleScore, sentiment:sentimentScore, options:0.1, fundamental:fundamentalScore });
    if(total.total < MIN_TOTAL) continue;
    const tierMin: 'pro'|'elite' = total.total >= 0.85 ? 'elite' : 'pro';
    const reason = total.label === 'Elite' ? 'Elite crypto setup (on-chain whales + momentum)' : 'High conviction crypto signal';
    const features = {
      price: last.c,
      pct_change_1d: change1d,
      pct_from_20d: pct20,
      pct_from_50d: pct50,
      rvol: relVol,
      whales: whales.length,
      whaleScore,
      sentimentScore,
      subs: total.subs,
    };
    outputs.push({
      symbol,
      asset_type:'crypto',
      score: total.total,
      reason,
      features,
      tier_min: tierMin,
      created_at: now,
      embargo_until: now + TIER_GATES.free.delaySeconds,
      uniq_key: stockUniq(`${symbol}-CRYPTO`, now, tierMin),
    });
  }
  return outputs;
}
