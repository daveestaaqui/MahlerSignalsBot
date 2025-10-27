const BASE = 'https://api.polygon.io';

export async function aggDaily(symbol: string, from: string, to: string, apiKey = process.env.POLYGON_KEY) {
  if (!apiKey) throw new Error('POLYGON_KEY missing');
  const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`polygon ${res.status}`);
  return res.json() as Promise<any>;
}
