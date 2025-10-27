const BASE = 'https://finnhub.io/api/v1';

export async function quote(symbol: string, apiKey = process.env.FINNHUB_KEY) {
  if (!apiKey) throw new Error('FINNHUB_KEY missing');
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return res.json() as Promise<any>;
}

export async function newsSentiment(symbol: string, apiKey = process.env.FINNHUB_KEY) {
  if (!apiKey) throw new Error('FINNHUB_KEY missing');
  const res = await fetch(`${BASE}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return res.json() as Promise<any>;
}
