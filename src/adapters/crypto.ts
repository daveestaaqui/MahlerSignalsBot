import { TokenBucket, withRetry } from '../lib/limits';

export type CryptoCandle = { t:number; o:number; h:number; l:number; c:number; v:number };
export type WhaleEvent = { hash:string; amount:number; from?:string; to?:string; direction:'inflow'|'outflow'; ts:number };

const COINGECKO_BUCKET = new TokenBucket(8, 8/60);
const WHALE_BUCKET = new TokenBucket(4, 4/60);

export async function getCryptoDaily(symbol:string): Promise<CryptoCandle[]> {
  if(process.env.DRY_RUN === 'true') return [];
  try {
    await COINGECKO_BUCKET.take(1);
    const url = `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/market_chart?vs_currency=usd&days=90`;
    const json = await withRetry(async ()=>{
      const res = await fetch(url, { headers:{'User-Agent':'AuroraSignalX/1.0'} });
      if(!res.ok) throw new Error(`coingecko ${res.status}`);
      return res.json();
    });
    const prices = Array.isArray(json?.prices) ? json.prices : [];
    const volumes = Array.isArray(json?.total_volumes) ? json.total_volumes : [];
    if(!prices.length) return [];
    return prices.map((p:any, idx:number)=>{
      const [t, price] = p;
      const vol = volumes[idx]?.[1] ?? volumes[idx] ?? 0;
      return { t:Number(t), o:Number(price), h:Number(price), l:Number(price), c:Number(price), v:Number(vol) };
    }).filter(c=>Number.isFinite(c.t) && Number.isFinite(c.c));
  } catch (err) {
    console.warn('[crypto] coingecko fetch failed', symbol, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getWhaleEvents(asset:string): Promise<WhaleEvent[]> {
  if(process.env.DRY_RUN === 'true') return [];
  const key = process.env.WHALE_ALERT_KEY;
  if(!key) return [];
  try {
    await WHALE_BUCKET.take(1);
    const url = new URL('https://api.whale-alert.io/v1/transactions');
    url.searchParams.set('api_key', key);
    url.searchParams.set('currency', asset.toLowerCase());
    url.searchParams.set('min_value', '500000');
    url.searchParams.set('start', String(Math.floor(Date.now()/1000) - 24*3600));
    const json = await withRetry(async ()=>{
      const res = await fetch(url, { headers:{'User-Agent':'AuroraSignalX/1.0'} });
      if(!res.ok) throw new Error(`whalealert ${res.status}`);
      return res.json();
    });
    const txs = Array.isArray(json?.transactions) ? json.transactions : [];
    return txs.map((tx:any)=>({
      hash: tx.hash || `whale-${Date.now()}`,
      amount: Number(tx.amount || 0),
      from: tx.from?.address,
      to: tx.to?.address,
      direction: tx.to?.owner_type === 'exchange' ? 'inflow' : 'outflow',
      ts: Number(tx.timestamp || Date.now()/1000),
    })).filter(tx=>Number.isFinite(tx.ts));
  } catch (err) {
    console.warn('[whalealert] fetch error', asset, err instanceof Error ? err.message : err);
    return [];
  }
}
