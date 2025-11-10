import { getDB } from "../lib/db";
import { SHORT_DISCLAIMER } from "../lib/legal";
import { logWarn } from "../lib/logger";

type AssetType = "stock" | "crypto";
type Tier = "free" | "pro" | "elite";

type SignalRow = {
  id: number;
  symbol: string;
  asset_type: AssetType;
  tier_min: Tier;
  score: number;
  reason: string;
  features?: string | Record<string, unknown> | null;
  created_at: number;
};

type SignalFeatures = {
  price?: number;
  pct_change_1d?: number;
  pct_from_20d?: number;
  pct_from_50d?: number;
  pct_from_200d?: number;
  rvol?: number;
  whales?: number;
  whaleScore?: number;
  sentimentScore?: number;
  optionsScore?: number;
  fundamentalScore?: number;
  flowUsd?: number;
  pct_from_50?: number;
  pct_from_200?: number;
  gapUp?: boolean;
  gapDown?: boolean;
};

export type Chain = "ethereum" | "solana" | "bitcoin" | "celestia";
export type AssetClass = "equity" | "l1" | "l2" | "defi" | "crypto";

export interface SignalView {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  chain?: Chain;
  timeframe: string;
  expectedMove: string;
  expectedMoveRange: { min: number; max: number; unit: "%" };
  stopLoss: string;
  rationale: string[];
  riskNote: string;
  disclaimer: string;
  entryPrice?: number;
  tier: Tier;
  score: number;
  generatedAt: string;
}

const SELECT_RECENT_SIGNALS = `
  SELECT id, symbol, asset_type, tier_min, score, reason, features, created_at
  FROM signals
  WHERE created_at >= ?
  ORDER BY score DESC, created_at DESC
  LIMIT ?
`;

const FRESH_WINDOW_SECONDS = 36 * 3600;
const DEFAULT_LIMIT = 12;

export function buildTodaySignals(now: Date = new Date()): SignalView[] {
  const since = Math.floor(now.getTime() / 1000) - FRESH_WINDOW_SECONDS;
  const rows = readRecentSignals(since, DEFAULT_LIMIT * 3);
  if (!rows.length) {
    logWarn("signals.today.empty", { since });
    return [];
  }

  const seenSymbols = new Set<string>();
  const views: SignalView[] = [];

  for (const row of rows) {
    if (seenSymbols.has(row.symbol)) continue;
    const view = toSignalView(row);
    if (!view) continue;
    views.push(view);
    seenSymbols.add(row.symbol);
    if (views.length >= DEFAULT_LIMIT) break;
  }

  return views.sort((a, b) => b.score - a.score);
}

function readRecentSignals(since: number, limit: number): SignalRow[] {
  try {
    const db = getDB();
    const stmt = db.prepare(SELECT_RECENT_SIGNALS);
    return stmt.all(since, limit) as SignalRow[];
  } catch (error) {
    logWarn("signals.today.db_failed", { error: describeError(error) });
    return [];
  }
}

function toSignalView(row: SignalRow): SignalView | null {
  const features = parseFeatures(row.features);
  if (!features) return null;

  const entryPrice = numberOrUndefined(features.price);
  if (!entryPrice || entryPrice <= 0) {
    return null;
  }

  const momentum =
    numberOrUndefined(features.pct_change_1d) ??
    numberOrUndefined(features.pct_from_20d) ??
    0;

  const timeframe = timeframeFor(row.asset_type, numberOrUndefined(features.rvol));
  const range = computeExpectedMove(row.asset_type, row.score, momentum);
  const expectedMove = `Model suggests a potential upside of ~${range.min.toFixed(
    1,
  )}–${range.max.toFixed(1)}% over the ${timeframe}, but this is not guaranteed.`;

  const meta = resolveAssetMeta(row.symbol, row.asset_type);
  const rationale = buildRationales(row.asset_type, row.symbol, features, row.score);
  if (!rationale.length) {
    rationale.push("Model detected reliable structure and liquidity, but treat this as informational only.");
  }

  return {
    id: String(row.id),
    symbol: row.symbol,
    assetClass: meta.assetClass,
    chain: meta.chain,
    timeframe,
    expectedMove,
    expectedMoveRange: range,
    stopLoss: stopLossText(entryPrice, row.asset_type, numberOrUndefined(features.rvol)),
    rationale,
    riskNote: riskNoteFor(row.asset_type, meta.chain),
    disclaimer: SHORT_DISCLAIMER,
    entryPrice,
    tier: row.tier_min,
    score: Number(row.score ?? 0),
    generatedAt: new Date(row.created_at * 1000).toISOString(),
  };
}

function parseFeatures(raw: SignalRow["features"]): SignalFeatures | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    return raw as SignalFeatures;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SignalFeatures;
    } catch {
      return null;
    }
  }
  return null;
}

function timeframeFor(assetType: AssetType, rvol?: number): string {
  const volume = rvol ?? 1;
  if (assetType === "stock") {
    if (volume >= 1.6) return "next 3–5 trading days";
    if (volume >= 1.2) return "next 1–2 weeks";
    return "next 1–4 weeks";
  }
  if (volume >= 1.8) return "next 12–36 hours";
  if (volume >= 1.3) return "next 2–4 days";
  return "next 3–6 days";
}

function computeExpectedMove(assetType: AssetType, score: number, momentum: number): {
  min: number;
  max: number;
  unit: "%";
} {
  const momentumPct = (momentum ?? 0) * 100;
  const base = assetType === "stock" ? { min: 2.5, span: 4.5 } : { min: 4, span: 7 };
  const scoreBoost = clamp((score - 0.8) * (assetType === "stock" ? 3.2 : 4.5), 0, assetType === "stock" ? 8 : 10);
  const momentumBoost = clamp(Math.abs(momentumPct) / 4, 0, assetType === "stock" ? 5 : 7);
  const min = clamp(base.min + scoreBoost * 0.6 + momentumBoost * 0.3, base.min, assetType === "stock" ? 14 : 22);
  const max = clamp(min + base.span + scoreBoost * 0.4 + momentumBoost * 0.4, min + 1.5, assetType === "stock" ? 20 : 30);
  return { min: Number(min.toFixed(1)), max: Number(max.toFixed(1)), unit: "%" };
}

function stopLossText(entryPrice: number, assetType: AssetType, rvol = 1): string {
  const vol = Math.max(rvol, 1);
  const base = assetType === "stock" ? 0.035 : 0.065;
  const pct = clamp(base * vol, assetType === "stock" ? 0.025 : 0.05, assetType === "stock" ? 0.08 : 0.15);
  const level = entryPrice * (1 - pct);
  return `Suggested risk guard: exit if price falls below $${level.toFixed(2)} or more than ${formatPercent(pct)} from entry.`;
}

function buildRationales(assetType: AssetType, symbol: string, features: SignalFeatures, score: number): string[] {
  const lines: string[] = [];
  const pct20 = numberOrUndefined(features.pct_from_20d);
  const pct50 = numberOrUndefined(features.pct_from_50d ?? features.pct_from_50);
  const pct200 = numberOrUndefined(features.pct_from_200d ?? features.pct_from_200);
  const pctChange1d = numberOrUndefined(features.pct_change_1d);
  const rvol = numberOrUndefined(features.rvol);
  const whaleScore = numberOrUndefined(features.whaleScore);
  const optionsScore = numberOrUndefined(features.optionsScore);
  const fundamentalScore = numberOrUndefined(features.fundamentalScore);
  const flowUsd = numberOrUndefined(features.flowUsd);

  if (typeof pct20 === "number") {
    if (pct20 >= 0) {
      lines.push(`Holding ${formatPercent(pct20)} above the 20-day trend with constructive higher lows.`);
    } else {
      lines.push(`Mean-reversion setup with price ${formatPercent(Math.abs(pct20))} below the 20-day trend.`);
    }
  }

  if (typeof pct50 === "number" && Math.abs(pct50) > 0.01) {
    lines.push(
      `${Math.abs(pct50) < 0.08 ? "Respecting" : pct50 > 0 ? "Breaking above" : "Reclaiming"} the 50-day baseline (${formatPercent(
        pct50,
      )} vs 50d).`,
    );
  } else if (typeof pct200 === "number" && Math.abs(pct200) > 0.02) {
    lines.push(`Longer-term trend ${pct200 > 0 ? "supporting" : "testing"} with price ${formatPercent(pct200)} vs 200d.`);
  }

  if (typeof pctChange1d === "number" && Math.abs(pctChange1d) >= 0.005) {
    lines.push(`Latest session move: ${formatPercent(pctChange1d)} with ${assetType === "stock" ? "institutional" : "on-chain"} interest starting to follow.`);
  }

  if (typeof rvol === "number" && rvol >= 1.1) {
    lines.push(`Relative volume running at ${rvol.toFixed(1)}x the 20-day average, signaling real participation.`);
  }

  if (assetType === "crypto" && typeof whaleScore === "number" && whaleScore >= 0.2) {
    lines.push(`Whale activity score ${whaleScore.toFixed(2)} with ${formatWhaleCount(features.whales)} large transfers flagged.`);
  }

  if (assetType === "stock" && typeof optionsScore === "number" && optionsScore >= 0.15) {
    lines.push(`Options flow skew elevated (${formatPercent(optionsScore)} of daily notional leaning bullish).`);
  }

  if (typeof flowUsd === "number" && flowUsd > 0) {
    lines.push(`Roughly ${formatUsd(flowUsd)} in directional flow over the last 24h keeps liquidity engaged.`);
  }

  if (typeof fundamentalScore === "number" && fundamentalScore >= 0.4) {
    lines.push(`Fundamental composite at ${formatPercent(fundamentalScore)} indicates improving backdrop (revenues/on-chain fees).`);
  }

  if (features.gapUp) {
    lines.push("Recent gap-up held support, suggesting institutions defended the breakout level.");
  } else if (features.gapDown) {
    lines.push("Gap-down flush completed and is now building a base above prior congestion.");
  }

  if (lines.length < 2) {
    lines.push(`Composite score ${score.toFixed(2)} cleared tier gates after volatility, but always size positions with care.`);
  }

  return lines.slice(0, 5);
}

function riskNoteFor(assetType: AssetType, chain?: Chain): string {
  if (assetType === "stock") {
    return "Equities remain sensitive to macro data, earnings revisions, and policy headlines—treat this as informational only.";
  }
  if (chain === "solana") {
    return "Solana ecosystems move fast and can gap on liquidity shocks—plan entries/exits and expect 24/7 volatility.";
  }
  if (chain === "ethereum") {
    return "Ethereum assets react quickly to on-chain flows and funding; assume elevated volatility and slippage.";
  }
  return "Digital assets trade 24/7 with high volatility and regulatory risk; never size beyond predefined loss limits.";
}

function resolveAssetMeta(symbol: string, assetType: AssetType): { assetClass: AssetClass; chain?: Chain } {
  if (assetType === "stock") {
    return { assetClass: "equity" };
  }
  const upper = symbol.toUpperCase();
  const chainMap: Record<string, Chain> = {
    ETH: "ethereum",
    ARB: "ethereum",
    OP: "ethereum",
    JUP: "solana",
    SOL: "solana",
    BTC: "bitcoin",
    TIA: "celestia",
  };
  const classMap: Record<string, AssetClass> = {
    BTC: "l1",
    ETH: "l1",
    SOL: "l1",
    TIA: "l1",
    ARB: "l2",
    OP: "l2",
    JUP: "defi",
  };
  return {
    assetClass: classMap[upper] ?? "crypto",
    chain: chainMap[upper],
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatWhaleCount(count?: number): string {
  if (!count || count <= 0) return "limited";
  if (count === 1) return "1 whale-sized";
  return `${count} whale-sized`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown_error";
}
