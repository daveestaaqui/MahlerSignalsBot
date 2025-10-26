import { score } from '../../signals/scoring.js';
import { fmtEliteStock, fmtPro, fmtFreeTeaser } from '../../services/formatters.js';
import { canPublish } from '../../services/gating.js';
export async function runStocksOnce(symbols:string[]){
  const out:any[]=[];
  for(const symbol of symbols){
    const s = score({ assetType:'stock', tech:0.6, sentiment:0.55, whale:0.7, options:0.1, fundamental:0.65 });
    const base = { symbol, price:undefined, pct:undefined, rvol:undefined, reason:'Momentum + whale + value blend', score:s.total, subs:s.subs, tier:'pro' as const, assetType:'stock' as const };
    if(canPublish('elite',{asset:'stock', whale:true, options:true})) out.push({ tier:'elite', text: fmtEliteStock(base) });
    if(canPublish('pro',{asset:'stock', whale:true})) out.push({ tier:'pro', text: fmtPro(base) });
    out.push({ tier:'free', text: fmtFreeTeaser(base) });
  }
  return out;
}
