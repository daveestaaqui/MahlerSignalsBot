import { fetch } from 'undici';
import { TokenBucket, withRetry } from '../lib/limits';

export type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

const POLYGON_KEY = process.env.POLYGON_KEY;
const bucket = new TokenBucket(4, 4/60); // ~4 calls per minute

export async function getStockDaily(symbol: string): Promise<Candle[]> {
  if(!POLYGON_KEY || process.env.DRY_RUN === 'true') {
    console.warn('[polygon] missing api key or in dry-run mode, skipping fetch for', symbol);
    return [];
  }
  const end = new Date();
  const start = new Date(end.getTime() - 90*86400*1000);
  const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${start.toISOString().slice(0,10)}/${end.toISOString().slice(0,10)}`);
  url.searchParams.set('adjusted','true');
  url.searchParams.set('sort','asc');
  url.searchParams.set('limit','120');
  url.searchParams.set('apiKey', POLYGON_KEY);

  try {
    await bucket.take(1);
    const json: unknown = await withRetry(async ()=>{
      const res = await fetch(url, { headers:{'User-Agent':'AuroraSignalX/1.0'} });
      if(!res.ok) throw new Error(`polygon ${res.status}`);
      return res.json();
    });
    const record = (typeof json === 'object' && json !== null) ? json as Record<string, unknown> : {};
    const results = record.results;
    if(!Array.isArray(results)) return [];
    return results.map((r:any)=>({
      t: Number(r.t || 0),
      o: Number(r.o || 0),
      h: Number(r.h || 0),
      l: Number(r.l || 0),
      c: Number(r.c || 0),
      v: Number(r.v || 0),
    })).filter(c=>Number.isFinite(c.t) && Number.isFinite(c.c));
  } catch (err) {
    console.warn('[polygon] fetch failed', symbol, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getOptionsFlow(symbol: string){
  // Future integrations may surface options flow signals (e.g., Unusual Whales) when credentials are provided.
  return [];
}
