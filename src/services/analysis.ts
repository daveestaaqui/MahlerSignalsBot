import { fetch } from "undici";
import { log } from "../lib/log";
import { LEGAL_FOOTER, CTA_FOOTER } from "../lib/legal";

type Meta = Record<string, unknown>;

const logger = {
  info: (msg: string, context?: Meta) => log("info", msg, context ?? {}),
  warn: (msg: string, context?: Meta) => log("warn", msg, context ?? {}),
  error: (msg: string, context?: Meta) => log("error", msg, context ?? {}),
};

export type DailySummaryOptions = {
  window: '24h' | '7d' | string;
};

interface Asset {
  symbol: string;
  name: string;
  price: number;
  change1h?: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap?: number;
  chain: 'ETH' | 'SOL' | 'BASE';
  score?: number;
}

interface AnalysisResult {
  timestamp: string;
  version: string;
  window: string;
  topMomentum: Asset[];
  underwatchlist: Asset[];
  summary: string;
  text: string;
  markdown: string;
  sources: {
    coingecko: boolean;
    dexscreener: boolean;
    sentiment: boolean;
  };
}

let lastCoinGeckoFetch = 0;
let lastDexScreenerFetch = 0;
const RATE_LIMIT_MS = 1000;

async function fetchWithRetry(url: string, timeout = 8000): Promise<any> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error(`Fetch failed: ${url}`, { error: describeError(error) });
    return null;
  }
}

async function fetchCoinGecko(): Promise<Asset[] | null> {
  try {
    const now = Date.now();
    if (now - lastCoinGeckoFetch < RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - (now - lastCoinGeckoFetch)));
    }
    lastCoinGeckoFetch = Date.now();

    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&sparkline=false&price_change_percentage=1h,24h,7d';
    const data = await fetchWithRetry(url);
    if (!data) return null;

    return data.slice(0, 100).map((coin: any) => ({
      symbol: coin.symbol?.toUpperCase() || 'UNK',
      name: coin.name,
      price: coin.current_price || 0,
      change1h: coin.price_change_percentage_1h_in_currency || 0,
      change24h: coin.price_change_percentage_24h_in_currency || 0,
      change7d: coin.price_change_percentage_7d_in_currency || 0,
      volume24h: coin.total_volume || 0,
      marketCap: coin.market_cap,
      chain: 'ETH'
    }));
  } catch (error) {
    logger.error("CoinGecko fetch error", { error: describeError(error) });
    return null;
  }
}

export async function buildSummary(options: DailySummaryOptions): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();
  const assets: Asset[] = [];
  const sources = { coingecko: false, dexscreener: false, sentiment: false };

  const cg = await fetchCoinGecko();
  if (cg) {
    assets.push(...cg);
    sources.coingecko = true;
  }

  if (assets.length === 0) {
    return {
      timestamp,
      version: '1.0.0',
      window: options.window,
      topMomentum: [],
      underwatchlist: [],
      summary: "No market data available.",
      text: "No market data available",
      markdown: "No market data available",
      sources
    };
  }

  const topMomentum = assets.slice(0, 5);
  const markdown = `Market Analysis: ${topMomentum
    .map((a) => `${a.symbol}: ${a.change24h.toFixed(1)}%`)
    .join(", ")}

${LEGAL_FOOTER}

${CTA_FOOTER}`;

  return {
    timestamp,
    version: '1.0.0',
    window: options.window,
    topMomentum,
    underwatchlist: [],
    summary: markdown,
    text: markdown,
    markdown,
    sources
  };
}

export async function buildNowSummary(): Promise<string> {
  const summary = await buildSummary({ window: "now" });
  return summary.markdown;
}

export async function buildDailySummary(window: "24h" | "7d" = "24h"): Promise<string> {
  const result = await buildSummary({ window });
  return result.markdown;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown_error";
}
