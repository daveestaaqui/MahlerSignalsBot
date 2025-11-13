import { fetch } from "undici";
import { SHORT_DISCLAIMER } from "../lib/legal";
import { logWarn } from "../lib/logger";

export type AssetClass = "stock" | "crypto";
export type Chain = "ethereum" | "solana";
export type DirectionBias = "bullish" | "bearish" | "neutral";

export interface SignalView {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  chain?: Chain;
  timeframe: string;
  expectedMove: string;
  stopLossHint?: string;
  rationale: {
    technical: string;
    fundamental?: string;
    macro?: string;
  };
  riskNote: string;
  disclaimer: string;
  dataSources: string[];
  asOf: string;
}

type SignalCandidate = {
  view: SignalView;
  score: number;
};

type MoveEnvelope = {
  min: number;
  max: number;
  bias: DirectionBias;
};

type PolygonAgg = {
  c?: number;
  v?: number;
  t?: number;
};

type PolygonAggResponse = {
  results?: PolygonAgg[];
};

type CryptoDirectoryEntry = {
  id: string;
  symbol: string;
  chain: "eth" | "solana" | "offchain";
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_1h_in_currency?: number;
};

const DEFAULT_EQUITIES = ["SPY", "QQQ", "NVDA", "AAPL", "MSFT", "TSLA"];
const DEFAULT_CRYPTO_IDS = ["bitcoin", "ethereum", "solana", "chainlink", "arbitrum", "optimism"];

const CRYPTO_DIRECTORY: Record<string, CryptoDirectoryEntry> = {
  bitcoin: { id: "bitcoin", symbol: "BTC", chain: "offchain" },
  ethereum: { id: "ethereum", symbol: "ETH", chain: "eth" },
  solana: { id: "solana", symbol: "SOL", chain: "solana" },
  chainlink: { id: "chainlink", symbol: "LINK", chain: "eth" },
  arbitrum: { id: "arbitrum", symbol: "ARB", chain: "eth" },
  optimism: { id: "optimism", symbol: "OP", chain: "eth" },
  avalanche: { id: "avalanche-2", symbol: "AVAX", chain: "offchain" },
  binancecoin: { id: "binancecoin", symbol: "BNB", chain: "offchain" },
  "matic-network": { id: "matic-network", symbol: "MATIC", chain: "eth" },
};

const EQUITY_API_BASE = process.env.EQUITY_API_BASE_URL || "https://api.polygon.io";
const CRYPTO_API_BASE =
  process.env.CRYPTO_API_BASE_URL || "https://api.coingecko.com/api/v3";
const EQUITY_WATCHLIST = parseEquityWatchlist(process.env.EQUITY_WATCHLIST);
const CRYPTO_WATCHLIST = parseCryptoWatchlist(process.env.CRYPTO_WATCHLIST);
const MAX_SIGNALS = 10;

export async function buildTodaySignals(now: Date = new Date()): Promise<SignalView[]> {
  const settled = await Promise.allSettled([
    fetchEquitySignals(now),
    fetchCryptoSignals(now),
  ]);

  const candidates: SignalCandidate[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      candidates.push(...result.value);
    } else {
      logWarn("signals.build.reject", { error: describeError(result.reason) });
    }
  }

  if (!candidates.length) {
    logWarn("signals.build.empty", {});
    return [];
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SIGNALS)
    .map((candidate) => candidate.view);
}

type BuildSignalViewParams = {
  symbol: string;
  assetClass: AssetClass;
  chain?: Chain;
  timeframe: string;
  move: MoveEnvelope;
  stopLossPct?: number;
  technical: string;
  fundamental?: string;
  macro?: string;
  riskNote: string;
  dataSources: string[];
  asOf: Date;
};

export function buildSignalView(params: BuildSignalViewParams): SignalView {
  const stopLossHint = typeof params.stopLossPct === "number"
    ? `Illustrative stop: roughly ${formatPercent(params.stopLossPct)} from entry based on observed volatility; always align with your own risk controls.`
    : undefined;

  return {
    id: createSignalId(params.symbol, params.timeframe, params.asOf),
    symbol: params.symbol,
    assetClass: params.assetClass,
    chain: params.chain,
    timeframe: params.timeframe,
    expectedMove: formatExpectedMoveText(params.symbol, params.timeframe, params.move),
    stopLossHint,
    rationale: {
      technical: params.technical,
      ...(params.fundamental ? { fundamental: params.fundamental } : {}),
      ...(params.macro ? { macro: params.macro } : {}),
    },
    riskNote: params.riskNote,
    disclaimer: SHORT_DISCLAIMER,
    dataSources: params.dataSources?.length ? params.dataSources : [],
    asOf: params.asOf.toISOString(),
  };
}

async function fetchEquitySignals(now: Date): Promise<SignalCandidate[]> {
  const apiKey = process.env.EQUITY_API_KEY;
  if (!apiKey) {
    logWarn("signals.equity.missing_key", {});
    return [];
  }

  const since = formatDate(daysAgo(now, 60));
  const until = formatDate(now);
  const promises = EQUITY_WATCHLIST.map((symbol) =>
    fetchPolygonSeries(symbol, since, until, apiKey)
      .then((series) => (series ? buildEquityCandidate(symbol, series, now) : null))
      .catch((error) => {
        logWarn("signals.equity.fetch_failed", {
          symbol,
          error: describeError(error),
        });
        return null;
      }),
  );

  const settled = await Promise.all(promises);
  return settled.filter((candidate): candidate is SignalCandidate => Boolean(candidate));
}

async function fetchPolygonSeries(
  symbol: string,
  since: string,
  until: string,
  apiKey: string,
): Promise<PolygonAgg[] | null> {
  const url = `${EQUITY_API_BASE}/v2/aggs/ticker/${encodeURIComponent(
    symbol,
  )}/range/1/day/${since}/${until}?adjusted=true&limit=120&apiKey=${apiKey}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`polygon_${response.status}`);
  }
  const data = (await response.json()) as PolygonAggResponse;
  if (!Array.isArray(data.results) || !data.results.length) {
    return null;
  }
  return data.results;
}

function buildEquityCandidate(
  symbol: string,
  series: PolygonAgg[],
  asOf: Date,
): SignalCandidate | null {
  const sorted = series
    .filter((row) => typeof row.c === "number" && typeof row.t === "number")
    .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
  if (sorted.length < 5) return null;

  const closes = sorted.map((row) => Number(row.c));
  const volumes = sorted.map((row) => Number(row.v || 0));
  const latest = sorted[sorted.length - 1]!;
  const prev = sorted[sorted.length - 2] ?? latest;
  const price = Number(latest.c ?? 0);
  const prevClose = Number(prev.c ?? price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const change1d = safePercent(price, prevClose);
  const pctFrom20 = percentFromAverage(closes, 20, price);
  const pctFrom50 = percentFromAverage(closes, 50, price);

  const recentVolumes = volumes.slice(-30).filter((value) => Number.isFinite(value));
  const avgVolume = average(recentVolumes);
  const rvol = avgVolume ? Number((latest.v || 0) / avgVolume) : undefined;

  const direction = determineDirection(change1d, pctFrom20);
  const timeframe = selectScenarioWindow(rvol ?? 1);
  const move = buildMoveEnvelope("stock", direction, change1d, pctFrom20, rvol, timeframe);
  const stopLossPct = computeStopLoss("stock", rvol);
  const rationales = buildEquityRationales({
    symbol,
    price,
    change1d,
    pctFrom20,
    pctFrom50,
    rvol,
  });
  const technical = summarizeRationaleLines(rationales);
  const fundamental = buildEquityFundamentalNote(symbol, avgVolume);
  const riskNote = buildRiskNote({
    assetClass: "stock",
    timeframe,
    volatilityMetric: rvol,
  });
  const macro = buildMacroContext({
    assetClass: "stock",
    timeframe,
    volatilityMetric: rvol,
  });

  const score =
    Math.abs(change1d) * 70 +
    Math.abs(pctFrom20 ?? 0) * 60 +
    (rvol ? Math.max(rvol - 1, 0) * 15 : 0);

  const view = buildSignalView({
    symbol,
    assetClass: "stock",
    timeframe,
    move,
    stopLossPct,
    technical,
    fundamental,
    macro,
    riskNote,
    dataSources: ["polygon.io"],
    asOf,
  });

  return { view, score };
}

async function fetchCryptoSignals(now: Date): Promise<SignalCandidate[]> {
  if (!CRYPTO_WATCHLIST.length) return [];
  const ids = CRYPTO_WATCHLIST.map((entry) => entry.id).join(",");
  const url = `${CRYPTO_API_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    ids,
  )}&sparkline=false&price_change_percentage=1h,24h,7d`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.CRYPTO_API_KEY) {
    headers["x-cg-pro-api-key"] = process.env.CRYPTO_API_KEY;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`coingecko_${response.status}`);
  }
  const payload = (await response.json()) as CoinGeckoMarket[];
  if (!Array.isArray(payload) || !payload.length) return [];

  const marketCapTotal = payload.reduce(
    (sum, row) => sum + Math.max(Number(row.market_cap || 0), 0),
    0,
  );

  const candidates: SignalCandidate[] = [];
  for (const row of payload) {
    const meta = findCryptoMeta(row.id);
    if (!meta) continue;
    const candidate = buildCryptoCandidate(row, meta, marketCapTotal, now);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

function buildCryptoCandidate(
  market: CoinGeckoMarket,
  meta: CryptoDirectoryEntry,
  totalMarketCap: number,
  asOf: Date,
): SignalCandidate | null {
  const price = Number(market.current_price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return null;

  const change24 = Number(market.price_change_percentage_24h ?? 0);
  const change7d = Number(market.price_change_percentage_7d_in_currency ?? 0);
  const change1h = Number(market.price_change_percentage_1h_in_currency ?? 0);
  const marketCap = Number(market.market_cap ?? 0);
  const volume = Number(market.total_volume ?? 0);
  const dominance = totalMarketCap > 0 ? marketCap / totalMarketCap : 0;
  const volumeRatio = marketCap > 0 ? volume / marketCap : 0;

  const direction = determineDirection(change24 / 100, change7d / 100);
  const heatScore = Math.max(
    Math.abs(change24) / 4,
    Math.abs(change7d) / 6,
    (volumeRatio ?? 0) * 3,
  );
  const timeframe = selectScenarioWindow(1 + heatScore);
  const move = buildMoveEnvelope(
    "crypto",
    direction,
    change24 / 100,
    change7d / 100,
    volumeRatio,
    timeframe,
  );
  const stopLossPct = computeStopLoss("crypto", volumeRatio);
  const rationales = buildCryptoRationales({
    symbol: meta.symbol,
    change24,
    change7d,
    change1h,
    volume,
    dominance,
    volumeRatio,
  });
  const technical = summarizeRationaleLines(rationales);
  const fundamental = buildCryptoFundamentalNote(meta.symbol, dominance);
  const riskNote = buildRiskNote({
    assetClass: "crypto",
    timeframe,
    volatilityMetric: volumeRatio,
    dominance,
  });
  const macro = buildMacroContext({
    assetClass: "crypto",
    timeframe,
    dominance,
    volatilityMetric: volumeRatio,
  });

  const score =
    Math.abs(change24) * 3 +
    Math.abs(change7d) * 1.5 +
    Math.max(volumeRatio, 0) * 80 +
    dominance * 100;

  const chain = meta.chain === "solana" ? "solana" : meta.chain === "eth" ? "ethereum" : undefined;

  const view = buildSignalView({
    symbol: meta.symbol,
    assetClass: "crypto",
    chain,
    timeframe,
    move,
    stopLossPct,
    technical,
    fundamental,
    macro,
    riskNote,
    dataSources: ["coingecko"],
    asOf,
  });

  return { view, score };
}

function buildMoveEnvelope(
  asset: AssetClass,
  direction: DirectionBias,
  changeComponent: number,
  trendComponent: number | undefined,
  volatilityComponent: number | undefined,
  horizon: string,
): MoveEnvelope {
  const magnitudeBase = asset === "stock" ? 4 : 8;
  const changePct = Math.abs(changeComponent || 0) * 100;
  const trendPct = Math.abs(trendComponent || 0) * 100;
  const volBoost =
    asset === "stock"
      ? Math.max((volatilityComponent ?? 1) - 1, 0) * 4
      : Math.max(volatilityComponent ?? 0, 0) * 10;
  const envelope = clampNumber(
    magnitudeBase + changePct * 0.25 + trendPct * 0.15 + volBoost,
    asset === "stock" ? 4 : 6,
    asset === "stock" ? 18 : 32,
  );

  const downsideMultiplier = direction === "bullish" ? 0.6 : direction === "bearish" ? 1.1 : 0.8;
  const upsideMultiplier = direction === "bearish" ? 0.55 : direction === "bullish" ? 1.1 : 0.8;

  return {
    min: Number((-envelope * downsideMultiplier).toFixed(1)),
    max: Number((envelope * upsideMultiplier).toFixed(1)),
    bias: direction,
  };
}

function computeStopLoss(asset: AssetClass, volatility?: number): number {
  const base = asset === "stock" ? 0.035 : 0.08;
  const volFactor = asset === "stock" ? (volatility ?? 1) : Math.max(volatility ?? 0.2, 0.2);
  const maxClamp = asset === "stock" ? 0.09 : 0.18;
  return Number(clampNumber(base * (1 + volFactor * 0.6), base * 0.6, maxClamp).toFixed(3));
}

function buildEquityRationales(params: {
  symbol: string;
  price: number;
  change1d: number;
  pctFrom20?: number;
  pctFrom50?: number;
  rvol?: number;
}): string[] {
  const { symbol, change1d, pctFrom20, pctFrom50, rvol } = params;
  const lines: string[] = [];

  if (typeof pctFrom20 === "number") {
    lines.push(
      `Price could sit ${formatPercent(Math.abs(pctFrom20))} ${pctFrom20 >= 0 ? "above" : "below"} the 20-day average per Polygon daily bars; if that spread persists the drift remains a potential ${pctFrom20 >= 0 ? "continuation" : "mean-reversion"} scenario and outcomes stay uncertain.`,
    );
  }

  if (typeof pctFrom50 === "number" && Math.abs(pctFrom50) >= 0.01) {
    lines.push(
      `Distance to the 50-day baseline could signal ${pctFrom50 >= 0 ? "constructive" : "mean-reversion"} pressure if this stretch persists; outcomes remain uncertain.`,
    );
  }

  if (Math.abs(change1d) >= 0.002) {
    lines.push(
      `Last close moved ${formatPercent(Math.abs(change1d))} ${change1d >= 0 ? "higher" : "lower"} with verifiable Polygon volume; if that impulse persists the bias could stay ${change1d >= 0 ? "constructive" : "defensive"}, yet outcomes remain uncertain.`,
    );
  }

  if (typeof rvol === "number" && Number.isFinite(rvol)) {
    lines.push(
      `Relative volume is ${rvol.toFixed(1)}x the trailing 30-day average, indicating potential ${rvol > 1 ? "follow-through" : "cooling"} participation if liquidity persists; outcomes remain uncertain.`,
    );
  }

  lines.push(
    `Model-estimated move references ${symbol} OHLCV (Polygon) plus volatility-based stop sizing; scenarios stay potential only and outcomes remain uncertain.`,
  );

  return lines.slice(0, 5);
}

function buildCryptoRationales(params: {
  symbol: string;
  change24?: number;
  change7d?: number;
  change1h?: number;
  volume?: number;
  dominance?: number;
  volumeRatio?: number;
}): string[] {
  const { symbol, change24, change7d, change1h, volume, dominance, volumeRatio } = params;
  const lines: string[] = [];

  if (typeof change24 === "number" && Number.isFinite(change24)) {
    lines.push(
      `${symbol} moved ${change24.toFixed(1)}% over the last 24h per CoinGecko spot markets; if that move persists it could keep a ${change24 >= 0 ? "constructive" : "defensive"} skew, though outcomes remain uncertain.`,
    );
  }

  if (typeof change7d === "number" && Number.isFinite(change7d)) {
    lines.push(`Seven-day drift is ${change7d.toFixed(1)}%, framing a potential scenario if conditions persist; outcomes uncertain.`);
  }

  if (typeof change1h === "number" && Math.abs(change1h) >= 0.2) {
    lines.push(`One-hour change registers ${change1h.toFixed(1)}%, flagging intraday momentum that could matter if it persists, yet outcomes remain uncertain.`);
  }

  if (typeof volume === "number" && volume > 0) {
    lines.push(
      `24h volume cleared ${formatUsd(volume)} (${((volumeRatio ?? 0) * 100).toFixed(1)}% of market cap), hinting at potential liquidity support if this pace persists; outcomes uncertain.`,
    );
  }

  if (typeof dominance === "number" && dominance > 0) {
    lines.push(
      `${(dominance * 100).toFixed(1)}% of tracked market cap sits in ${symbol}, which could aid signal quality if dominance holds, though outcomes remain uncertain.`,
    );
  }

  lines.push(
    "Models blend CoinGecko spot feeds with dominance and volume ratios; forecasts stay probabilistic and outcomes are uncertain.",
  );
  return lines.slice(0, 5);
}

function summarizeRationaleLines(lines: string[]): string {
  if (!lines.length) {
    return "Model found a potential setup using current Polygon and CoinGecko inputs; outcomes are uncertain.";
  }
  if (lines.length === 1) return lines[0]!;
  return `${lines[0]} ${lines[1]}`;
}

function buildEquityFundamentalNote(symbol: string, avgVolume?: number): string | undefined {
  if (!avgVolume) {
    return `${symbol} remains on the US mega-cap watchlist; confirm earnings and macro catalysts before acting.`;
  }
  return `${symbol} averages roughly ${formatUsd(avgVolume)} of daily volume, keeping liquidity solid, but earnings and macro releases can still reset the story quickly.`;
}

function buildCryptoFundamentalNote(symbol: string, dominance?: number): string | undefined {
  if (!dominance || dominance <= 0) {
    return `${symbol} sits inside the tracked large-cap crypto set; regulatory or funding shifts can swing conviction rapidly.`;
  }
  return `${symbol} accounts for ${(dominance * 100).toFixed(1)}% of tracked crypto market cap in our universe, yet on-chain and policy developments can shift that share abruptly.`;
}

function buildRiskNote(params: {
  assetClass: AssetClass;
  timeframe: string;
  volatilityMetric?: number;
  dominance?: number;
}): string {
  const segments: string[] = [];
  if (params.assetClass === "stock") {
    segments.push("Equity scenarios remain sensitive to earnings headlines and macro data releases.");
    if (typeof params.volatilityMetric === "number" && Number.isFinite(params.volatilityMetric)) {
      segments.push(
        `Relative volume near ${params.volatilityMetric.toFixed(1)}x normal can expand slippage.`,
      );
    }
  } else {
    segments.push("Crypto liquidity depends on venue depth and funding; moves can overshoot quickly.");
    if (typeof params.dominance === "number" && params.dominance > 0) {
      segments.push(`${(params.dominance * 100).toFixed(1)}% dominance keeps flows concentrated.`);
    }
  }
  segments.push(
    `Treat the ${params.timeframe} scenario as probabilistic only and size positions with independent risk controls.`,
  );
  return segments.join(" ");
}

function buildMacroContext(params: {
  assetClass: AssetClass;
  timeframe: string;
  volatilityMetric?: number;
  dominance?: number;
}): string {
  if (params.assetClass === "stock") {
    const rvolText =
      typeof params.volatilityMetric === "number" && Number.isFinite(params.volatilityMetric)
        ? `${params.volatilityMetric.toFixed(1)}x relative volume`
        : "Baseline volume";
    return `${rvolText} meets the current U.S. macro calendar; policy speeches and data releases can reverse the ${params.timeframe} setup without notice.`;
  }
  const dominanceText =
    typeof params.dominance === "number" && params.dominance > 0
      ? `${(params.dominance * 100).toFixed(1)}% dominance`
      : "Liquidity concentration across majors";
  return `${dominanceText} plus funding and L1 gas shifts can jolt sentiment over the ${params.timeframe} window; scenarios stay illustrative only.`;
}

function formatExpectedMoveText(symbol: string, timeframe: string, move: MoveEnvelope): string {
  const minLabel = formatSignedPercent(move.min);
  const maxLabel = formatSignedPercent(move.max);
  const biasText =
    move.bias === "neutral"
      ? "a balanced"
      : move.bias === "bullish"
      ? "a constructive"
      : "a defensive";
  return `${symbol} ${timeframe} scenario: potential ${biasText} move of ${minLabel} to ${maxLabel} if current conditions persist; outcomes are never guaranteed.`;
}

function formatSignedPercent(value: number): string {
  const fixed = Number(value).toFixed(1);
  return value > 0 ? `+${fixed}%` : `${fixed}%`;
}

function createSignalId(symbol: string, timeframe: string, asOf: Date): string {
  const symbolSlug = symbol.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  const timeframeSlug = timeframe.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${symbolSlug || "SIGNAL"}-${timeframeSlug || "window"}-${asOf.toISOString()}`;
}

function determineDirection(momentum?: number, trend?: number): DirectionBias {
  const composite = (momentum ?? 0) + (trend ?? 0);
  if (composite >= 0.01) return "bullish";
  if (composite <= -0.01) return "bearish";
  return "neutral";
}

function selectScenarioWindow(heat: number): string {
  return heat > 1.25 ? "next 1–3 days" : "next 3–7 days";
}

function percentFromAverage(values: number[], window: number, price: number): number | undefined {
  const avg = average(values.slice(-window));
  if (!avg) return undefined;
  return (price - avg) / avg;
}

function safePercent(current: number, reference: number): number {
  if (!reference || reference === 0) return 0;
  return (current - reference) / reference;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function average(values: number[]): number | undefined {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return undefined;
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return sum / filtered.length;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown_error";
}

function parseEquityWatchlist(raw?: string): string[] {
  const list = (raw || "")
    .split(/[, ]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const finalList = list.length ? list : DEFAULT_EQUITIES;
  return Array.from(new Set(finalList));
}

function parseCryptoWatchlist(raw?: string): CryptoDirectoryEntry[] {
  const requested = (raw || "")
    .split(/[, ]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const ids = requested.length ? requested : DEFAULT_CRYPTO_IDS;
  const entries = ids
    .map((key) => findCryptoMeta(key) ?? createCustomCryptoEntry(key))
    .filter((entry): entry is CryptoDirectoryEntry => Boolean(entry));
  if (entries.length) {
    return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
  }
  return DEFAULT_CRYPTO_IDS.map((key) => CRYPTO_DIRECTORY[key]).filter(Boolean);
}

function findCryptoMeta(raw: string): CryptoDirectoryEntry | undefined {
  const normalized = raw.toLowerCase();
  if (CRYPTO_DIRECTORY[normalized]) return CRYPTO_DIRECTORY[normalized];
  return Object.values(CRYPTO_DIRECTORY).find(
    (entry) => entry.symbol.toLowerCase() === normalized || entry.id === normalized,
  );
}

function createCustomCryptoEntry(raw: string): CryptoDirectoryEntry {
  const normalized = raw.trim().toLowerCase();
  return {
    id: normalized,
    symbol: raw.trim().toUpperCase(),
    chain: "offchain",
  };
}
