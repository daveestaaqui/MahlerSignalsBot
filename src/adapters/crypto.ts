// Crypto adapter stubs using CoinGecko / Whale Alert environment keys.
// Networking calls are replaced with mock data in this environment.

import { TokenBucket, withRetry } from '../lib/limits.js';

export type CryptoCandle = { t:number; o:number; h:number; l:number; c:number; v:number };
export type WhaleEvent = { hash:string; amount:number; direction:'inflow'|'outflow'; ts:number };

const COINGECKO_BUCKET = new TokenBucket(8, 8/60);
const WHALE_BUCKET = new TokenBucket(4, 4/60);

function mockCandles(symbol:string): CryptoCandle[] {
  const now = Date.now();
  return Array.from({length:90}).map((_,i)=>{
    const drift = 30 + (symbol.charCodeAt(0)%10);
    const base = drift + Math.sin(i/7)*3 + Math.random();
    return {
      t: now - (90-i)*86400*1000,
      o: base * (0.99 + Math.random()*0.02),
      h: base * (1.01 + Math.random()*0.02),
      l: base * (0.98 - Math.random()*0.02),
      c: base * (0.99 + Math.random()*0.02),
      v: 40_000_000 + Math.random()*8_000_000,
    };
  });
}

export async function getCryptoDaily(symbol:string): Promise<CryptoCandle[]> {
  if (process.env.DRY_RUN === 'true') return mockCandles(symbol);
  await COINGECKO_BUCKET.take(1);
  return withRetry(async () => {
    // TODO: fetch `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart?...`
    return mockCandles(symbol);
  });
}

export async function getWhaleEvents(symbol:string): Promise<WhaleEvent[]> {
  if (process.env.DRY_RUN === 'true' || !process.env.WHALE_ALERT_KEY) {
    return [{ hash:`mock-${symbol}-${Date.now()}`, amount:5_000_000, direction:'outflow', ts:Date.now()/1000 }];
  }
  await WHALE_BUCKET.take(1);
  return withRetry(async () => {
    // TODO: fetch Whale Alert API using WHALE_ALERT_KEY
    return [] as WhaleEvent[];
  });
}
