import { TokenBucket, withRetry } from '../../lib/limits';

const API = 'https://www.alphavantage.co/query';
const key = process.env.ALPHAVANTAGE_KEY;
const bucket = new TokenBucket(5, 5 / 60); // ~5 calls per minute

async function call(params: Record<string, string>) {
  if (!key) throw new Error('ALPHAVANTAGE_KEY missing');
  const qs = new URLSearchParams({ ...params, apikey: key }).toString();
  await bucket.take(1);
  return withRetry(async () => {
    const res = await fetch(`${API}?${qs}`, {
      headers: { 'User-Agent': 'AuroraSignalX/1.0' }
    });
    if (!res.ok) throw new Error(`alphaVantage ${res.status}`);
    const body = await res.json();
    if (body?.Note || body?.Information) throw new Error('Alpha Vantage throttled');
    return body;
  });
}

export async function daily(symbol: string) {
  return call({ function: 'TIME_SERIES_DAILY_ADJUSTED', symbol });
}
