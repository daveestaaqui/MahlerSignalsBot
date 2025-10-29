import { TokenBucket, withRetry } from '../lib/limits.js';

export type Candle = { t:number; o:number; h:number; l:number; c:number; v:number };

const POLYGON_KEY = process.env.POLYGON_KEY;
const bucket = new TokenBucket(4, 4/60); // ~4 calls per minute

function mockSeries(symbol:string): Candle[] {
  const now = Date.now();
  return Array.from({length:60}).map((_,i)=>{
    const base = 100 + Math.sin(i/6) * 5 + (symbol.charCodeAt(0)%10);
    return {
      t: now - (60-i)*86400*1000,
      o: base * (0.99 + Math.random()*0.02),
      h: base * (1.01 + Math.random()*0.02),
      l: base * (0.98 - Math.random()*0.02),
      c: base * (0.99 + Math.random()*0.02),
      v: 5_000_000 + Math.random()*1_000_000,
    };
  });
}

export async function getStockDaily(symbol: string): Promise<Candle[]> {
  if(!POLYGON_KEY || process.env.DRY_RUN === 'true') {
    return mockSeries(symbol.toUpperCase());
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
    const json = await withRetry(async ()=>{
      const res = await fetch(url, { headers:{'User-Agent':'AuroraSignalX/1.0'} });
      if(!res.ok) throw new Error(`polygon ${res.status}`);
      return res.json();
    });
    const results = json?.results;
    if(!Array.isArray(results)) return mockSeries(symbol.toUpperCase());
    return results.map((r:any)=>({
      t: Number(r.t || 0),
      o: Number(r.o || 0),
      h: Number(r.h || 0),
      l: Number(r.l || 0),
      c: Number(r.c || 0),
      v: Number(r.v || 0),
    })).filter(c=>c.t && c.c);
  } catch (err) {
    console.warn('[polygon] falling back to synthetic series', symbol, err instanceof Error ? err.message : err);
    return mockSeries(symbol.toUpperCase());
  }
}

export async function getOptionsFlow(symbol: string){
  // TODO: Integrate options flow provider (e.g., Unusual Whales) once credentials available.
  return [];
}
