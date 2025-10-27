// Polygon equity adapter (stubbed fetch bodies to avoid network calls here)
// Uses POLYGON_KEY env when running in production.

import { TokenBucket, withRetry } from '../lib/limits.js';

export type PolygonCandle = { t:number; o:number; h:number; l:number; c:number; v:number };

const POLYGON_KEY = process.env.POLYGON_KEY || process.env.FMP_KEY || '';
const bucket = new TokenBucket(5, 5/60); // ~5 calls per minute

function mockSeries(symbol:string): PolygonCandle[] {
  const now = Date.now();
  return Array.from({length:90}).map((_,i)=>{
    const base = 100 + Math.sin(i/6) * 5 + (symbol.charCodeAt(0)%7);
    return {
      t: now - (90-i)*86400*1000,
      o: base * (0.99 + Math.random()*0.02),
      h: base * (1.01 + Math.random()*0.02),
      l: base * (0.98 - Math.random()*0.02),
      c: base * (0.99 + Math.random()*0.02),
      v: 5_000_000 + Math.random()*1_500_000,
    };
  });
}

export async function getStockDaily(symbol: string): Promise<PolygonCandle[]> {
  if (!POLYGON_KEY || process.env.DRY_RUN === 'true') {
    return mockSeries(symbol.toUpperCase());
  }
  // TODO: Replace with real fetch to Polygon once networking is allowed.
  await bucket.take(1);
  return withRetry(async () => {
    // Placeholder body: fetch + JSON parsing goes here.
    // const res = await fetch(`https://api.polygon.io/...&apiKey=${POLYGON_KEY}`);
    // return normalize(await res.json());
    return mockSeries(symbol.toUpperCase());
  });
}

export async function getOptionsFlow(symbol: string): Promise<any[]> {
  // TODO: integrate options flow provider (UnusualWhales, Finnhub options, etc.)
  return [];
}
