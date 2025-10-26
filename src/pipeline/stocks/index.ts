import { getStockDaily, getOptionsFlow, Candle } from '../../adapters/polygon.js';
import { score } from '../../signals/scoring.js';
import { stockUniq, type SignalRecord } from '../../signals/rules.js';
import { TIER_GATES } from '../../config/tiers.js';
import { sma, rvol, gapFlags } from '../../lib/indicators.js';

const MIN_TOTAL = 0.65;

function clamp(v:number){ return Math.max(0, Math.min(1, v)); }

function computeTech(candles:Candle[]): { tech:number; pct20:number; pct200:number; rvolVal:number; change1d:number; gapUp:boolean; gapDown:boolean } {
  const sorted = [...candles].sort((a,b)=>a.t-b.t);
  const closes = sorted.map(c=>c.c);
  const vols = sorted.map(c=>c.v);
  const last = sorted[sorted.length-1];
  const prev = sorted[sorted.length-2];
  const sma20 = sma(closes,20) ?? last.c;
  const sma200 = sma(closes,200) ?? sma20;
  const pct20 = (last.c - sma20) / sma20;
  const pct200 = (last.c - sma200) / sma200;
  const rv = rvol(vols,20) ?? 1;
  const change1d = (last.c - prev.c) / prev.c;
  const { gapUp, gapDown } = gapFlags(prev,last);
  const momentumScore = clamp(0.5 + pct20/0.18 + change1d/0.12);
  const trendScore = clamp(0.5 + pct200/0.25);
  const rvolScore = clamp((rv-1)/1.5 + 0.5);
  const tech = clamp((momentumScore*0.55 + trendScore*0.25 + rvolScore*0.2));
  return { tech, pct20, pct200, rvolVal:rv, change1d, gapUp, gapDown };
}

export async function runStocks(symbols: string[]): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now()/1000);
  const signals: SignalRecord[] = [];

  for (const rawSymbol of symbols) {
    const symbol = rawSymbol.toUpperCase();
    let candles: Candle[] = [];
    try {
      candles = await getStockDaily(symbol);
    } catch (err) {
      console.error('[stocks] fetch failed', symbol, err);
      continue;
    }
    if(!candles || candles.length < 40) continue;
    const { tech, pct20, pct200, rvolVal, change1d, gapUp, gapDown } = computeTech(candles);
    const whaleScore = clamp(Math.abs(change1d) * 5 + (gapUp?0.15:0) + (rvolVal>1.5?0.1:0));
    const optionsFlow = await getOptionsFlow(symbol).catch(()=>[]);
    const optionsScore = clamp((optionsFlow?.length || 0)/10);
    const sentimentScore = clamp(0.5 + change1d/0.08);
    const fundamentalScore = clamp(0.6 - pct200/0.3);
    const totalScore = score({ assetType:'stock', tech, sentiment:sentimentScore, whale:whaleScore, options:optionsScore, fundamental:fundamentalScore });
    if(totalScore.total < MIN_TOTAL) continue;
    const tierMin: 'pro'|'elite' = totalScore.total >= 0.85 ? 'elite' : 'pro';
    const reason = totalScore.label === 'Elite' ? 'Elite conviction (momentum + accumulation)' : 'High conviction setup';
    const last = candles[candles.length-1];
    const prev = candles[candles.length-2];
    const features = {
      price: last.c,
      pct_change_1d: change1d,
      pct_from_20d: pct20,
      pct_from_200d: pct200,
      rvol: rvolVal,
      gapUp,
      gapDown,
      whaleScore,
      optionsScore,
      sentimentScore,
      fundamentalScore,
      planEntry: `${(last.c*0.995).toFixed(2)}-${(last.c*1.01).toFixed(2)}`,
      planTarget: (last.c * 1.05).toFixed(2),
      planStop: (last.c * 0.97).toFixed(2),
      subs: totalScore.subs,
    };
    signals.push({
      symbol,
      asset_type: 'stock',
      score: totalScore.total,
      reason,
      features,
      tier_min: tierMin,
      created_at: now,
      embargo_until: now + TIER_GATES.free.delaySeconds,
      uniq_key: stockUniq(symbol, now, tierMin),
    });
  }
  return signals;
}
