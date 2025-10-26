import { score } from '../../signals/scoring.js';
import { fmtEliteCrypto, fmtPro, fmtFreeTeaser } from '../../services/formatters.js';
import { canPublish } from '../../services/gating.js';
export async function runCryptoOnce(symbols:string[]){
  const out:any[]=[];
  for(const symbol of symbols){
    const s = score({ assetType:'crypto', tech:0.55, sentiment:0.6, whale:0.75, options:0.0, fundamental:0.2 });
    const base = { symbol, price:undefined, pct:undefined, rvol:undefined, reason:'On-chain whale accumulation + momentum', score:s.total, subs:s.subs, tier:'pro' as const, assetType:'crypto' as const };
    if(canPublish('elite',{asset:'crypto', whale:true})) out.push({ tier:'elite', text: fmtEliteCrypto(base) });
    if(canPublish('pro',{asset:'crypto', whale:true})) out.push({ tier:'pro', text: fmtPro(base) });
    out.push({ tier:'free', text: fmtFreeTeaser(base) });
  }
  return out;
}
