export async function getDaily(symbol: string, apiKey = process.env.ALPHAVANTAGE_KEY) {
  if (!apiKey) throw new Error('ALPHAVANTAGE_KEY missing');
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`alphaVantage ${res.status}`);
  return res.json() as Promise<any>;
}
