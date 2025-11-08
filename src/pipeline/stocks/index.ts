import { getStockDaily, getOptionsFlow, Candle } from '../../adapters/polygon';
import { score } from '../../signals/scoring';
import { stockUniq, type SignalRecord } from '../../signals/rules';
import { TIER_GATES } from '../../config/tiers';
import { POSTING_RULES } from '../../config/posting';
import { sma, rvol, gapFlags } from '../../lib/indicators';

const MIN_TOTAL = Math.max(POSTING_RULES.MIN_SCORE_PRO, 0.65);

function clamp(v:number){ return Math.max(0, Math.min(1, v)); }

function computeFeatures(candles:Candle[]){
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
  const gapInfo = gapFlags(prev,last);
  const momentumScore = clamp(0.5 + pct20/0.18 + change1d/0.12);
  const trendScore = clamp(0.5 + pct200/0.25);
  const rvolScore = clamp((relVol-1)/1.5 + 0.5);
  const techScore = clamp(momentumScore*0.55 + trendScore*0.25 + rvolScore*0.2);
  return { last, prev, pct20, pct200, relVol, change1d, gapInfo, techScore };
}

export async function runStocksOnce(symbols: readonly string[]): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now()/1000);
  const signals: SignalRecord[] = [];
  for (const rawSymbol of symbols) {
    const symbol = rawSymbol.toUpperCase();
    const candles = await getStockDaily(symbol).catch((err)=>{ console.error('[stocks] fetch failed', symbol, err); return []; });
    if(!candles || candles.length < 50) continue;
    const { last, pct20, pct200, relVol, change1d, gapInfo, techScore } = computeFeatures(candles);
    const whaleScore = clamp((relVol-1)/1.5 + (gapInfo.gapUp ? 0.1 : 0) + (change1d>0 ? 0.1 : 0));
    const sentimentScore = clamp(0.5 + change1d/0.1);
    const optionsFlow = await getOptionsFlow(symbol).catch(()=>[]);
    const optionsScore = clamp((optionsFlow?.length || 0) / 10);
    const flowUsd = Array.isArray(optionsFlow)
      ? optionsFlow.reduce((sum:number, item:any)=>{
          const raw = item?.notionalUsd ?? item?.notional ?? item?.usd ?? 0;
          const value = typeof raw === 'number' ? raw : Number(raw);
          return Number.isFinite(value) ? sum + value : sum;
        }, 0)
      : 0;
    const fundamentalScore = clamp(0.6 - pct200/0.25);
    const total = score({ assetType:'stock', tech:techScore, sentiment:sentimentScore, whale:whaleScore, options:optionsScore, fundamental:fundamentalScore });
    if(total.total < MIN_TOTAL) continue;
    const tierMin: 'pro'|'elite' = total.total >= POSTING_RULES.MIN_SCORE_ELITE ? 'elite' : 'pro';
    const reason = total.label === 'Elite' ? 'Momentum + accumulation lining up' : 'High conviction setup';
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
      flowUsd,
    };
    signals.push({
      symbol,
      asset_type: 'stock',
      score: total.total,
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
