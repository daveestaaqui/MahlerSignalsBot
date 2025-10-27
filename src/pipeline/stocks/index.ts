import { getStockDaily, PolygonCandle, getOptionsFlow } from '../../adapters/polygon.js';
import { TokenBucket } from '../../lib/limits.js';
import { sma, rvol, gap } from '../../lib/indicators.js';
import { score } from '../../signals/scoring.js';
import { stockUniq, type SignalRecord } from '../../signals/rules.js';
import { TIER_GATES } from '../../config/tiers.js';

const MIN_TOTAL = 0.65;
const bucket = new TokenBucket(2, 2/60); // throttle scoring if necessary

function clamp(val:number){ return Math.max(0, Math.min(1,val)); }

function computeFeatures(candles: PolygonCandle[]){
  const sorted = [...candles].sort((a,b)=>a.t-b.t);
  const closes = sorted.map(c=>c.c);
  const vols = sorted.map(c=>c.v);
  const last = sorted[sorted.length-1];
  const prev = sorted[sorted.length-2];
  const sma20 = sma(closes,20) ?? last.c;
  const sma200 = sma(closes,200) ?? sma20;
  const pct20 = (last.c - sma20) / sma20;
  const pct200 = (last.c - sma200) / sma200;
  const relVol = rvol(vols,20) ?? 1;
  const change1d = (last.c - prev.c) / prev.c;
  const gapInfo = gap(prev,last);
  return { last, prev, pct20, pct200, relVol, change1d, gapInfo };
}

export async function runStocksOnce(symbols: string[]): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now()/1000);
  const results: SignalRecord[] = [];
  for(const raw of symbols){
    const symbol = raw.toUpperCase();
    await bucket.take(1);
    const candles = await getStockDaily(symbol).catch(()=>[]);
    if(!candles || candles.length < 60) continue;
    const { pct20, pct200, relVol, change1d, gapInfo, last } = computeFeatures(candles);
    const techScore = clamp(0.55 + pct20/0.18 + change1d/0.12);
    const whaleScore = clamp((relVol-1)/1.5 + (gapInfo.gapUp?0.1:0) + (change1d>0?0.1:0));
    const sentimentScore = clamp(0.5 + change1d/0.1);
    const optionsFlow = await getOptionsFlow(symbol).catch(()=>[]);
    const optionsScore = clamp((optionsFlow?.length || 0)/10);
    const fundamentalScore = clamp(0.6 - pct200/0.25);
    const total = score({ assetType:'stock', tech:techScore, whale:whaleScore, sentiment:sentimentScore, options:optionsScore, fundamental:fundamentalScore });
    if(total.total < MIN_TOTAL) continue;
    const tierMin: 'pro'|'elite' = total.total >= 0.85 ? 'elite' : 'pro';
    const reason = total.label === 'Elite' ? 'Elite conviction: trend + accumulation' : 'High conviction: momentum + flow';
    const features = {
      price: last.c,
      pct_change_1d: change1d,
      pct_from_20d: pct20,
      pct_from_200d: pct200,
      rvol: relVol,
      gapUp: gapInfo.gapUp,
      gapDown: gapInfo.gapDown,
      whaleScore,
      sentimentScore,
      optionsScore,
      fundamentalScore,
      subs: total.subs,
    };
    results.push({
      symbol,
      asset_type:'stock',
      score: total.total,
      reason,
      features,
      tier_min: tierMin,
      created_at: now,
      embargo_until: now + TIER_GATES.free.delaySeconds,
      uniq_key: stockUniq(symbol, now, tierMin),
    });
  }
  return results;
}
