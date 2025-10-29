const BASE = 'https://finnhub.io/api/v1';
const PROVIDER_TIMEOUT_MS = Number(process.env.HTTP_PROVIDER_TIMEOUT_MS ?? '4500');

type QuotePayload = {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
};

type SentimentPayload = {
  symbol: string;
  buzz: Record<string, number>;
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  bullishPercent: number;
  newsScore: number;
};

export async function quote(symbol: string, apiKey = process.env.FINNHUB_KEY): Promise<QuotePayload> {
  if (!apiKey) {
    return fallbackQuote();
  }
  try {
    const res = await fetchWithTimeout(
      `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (!res.ok) throw new Error(`finnhub ${res.status}`);
    return (await res.json()) as QuotePayload;
  } catch (err) {
    console.warn('[finnhub] quote fallback', { symbol, reason: formatError(err) });
    return fallbackQuote();
  }
}

export async function newsSentiment(symbol: string, apiKey = process.env.FINNHUB_KEY): Promise<SentimentPayload> {
  if (!apiKey) {
    return fallbackSentiment(symbol);
  }
  try {
    const res = await fetchWithTimeout(
      `${BASE}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (!res.ok) throw new Error(`finnhub ${res.status}`);
    return (await res.json()) as SentimentPayload;
  } catch (err) {
    console.warn('[finnhub] sentiment fallback', { symbol, reason: formatError(err) });
    return fallbackSentiment(symbol);
  }
}

function fallbackQuote(): QuotePayload {
  return { c: 0, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0 };
}

function fallbackSentiment(symbol: string): SentimentPayload {
  return {
    symbol,
    buzz: { articlesInLastWeek: 0, buzz: 0, weeklyAverage: 0 },
    companyNewsScore: 0,
    sectorAverageBullishPercent: 0,
    sectorAverageNewsScore: 0,
    bullishPercent: 0,
    newsScore: 0,
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AuroraSignalX/1.0' } });
  } finally {
    clearTimeout(timeout);
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
