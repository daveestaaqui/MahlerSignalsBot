const BASE = 'https://api.polygon.io';

function assertKey(key?: string) {
  if (!key) throw new Error('POLYGON_KEY missing');
  return key;
}

export async function aggDaily(symbol: string, from: string, to: string, key = process.env.POLYGON_KEY) {
  const token = assertKey(key);
  const res = await fetch(`${BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?apiKey=${token}`);
  if (!res.ok) throw new Error(`polygon ${res.status}`);
  return res.json();
}
