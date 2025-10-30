import { withRetry } from '../../lib/limits.js';

const PROVIDER_TIMEOUT_MS = Number(process.env.HTTP_PROVIDER_TIMEOUT_MS ?? '4500');

export async function getDaily(symbol: string, apiKey = process.env.ALPHAVANTAGE_KEY) {
  if (!apiKey) {
    console.warn('[alphaVantage] missing API key, returning empty payload');
    return fallbackPayload();
  }
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const json = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
        try {
          const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AuroraSignalX/1.0' } });
          if (!res.ok) throw new Error(`alphaVantage ${res.status}`);
          return res.json();
        } finally {
          clearTimeout(timeout);
        }
      },
      3,
      400,
    );
    return json;
  } catch (err) {
    console.warn('[alphaVantage] fetch failed, returning empty payload', symbol, formatReason(err));
    return fallbackPayload();
  }
}

function fallbackPayload() {
  return { 'Time Series (Daily)': {} };
}

function formatReason(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}
