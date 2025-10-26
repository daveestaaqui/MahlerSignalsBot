const BASE = 'https://finnhub.io/api/v1';

function assertKey(key?: string): string {
  if (!key) throw new Error('FINNHUB_KEY missing');
  return key;
}

export async function quote(symbol: string, key = process.env.FINNHUB_KEY) {
  const token = assertKey(key);
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return res.json();
}

export async function newsSentiment(symbol: string, key = process.env.FINNHUB_KEY) {
  const token = assertKey(key);
  const res = await fetch(`${BASE}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${token}`);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return res.json();
}
