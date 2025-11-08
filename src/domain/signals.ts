import { SHORT_DISCLAIMER } from "./legal";

export type AssetClass = "stock" | "crypto-eth" | "crypto-sol";
export type Timeframe = "intraday" | "1-3 days" | "1-2 weeks" | "1-3 months";
export type SignalDirection = "bullish" | "bearish" | "neutral";

export interface SignalSummary {
  symbol: string;
  assetClass: AssetClass;
  direction: SignalDirection;
  timeframe: Timeframe;
  expectedMovePctRange: { min: number; max: number };
  stopLossPct?: number;
  confidence: number; // 0-1 scale
  rationale: string;
  generatedAt: string;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function describeAssetClass(assetClass: AssetClass): string {
  switch (assetClass) {
    case "stock":
      return "equity";
    case "crypto-eth":
      return "Ethereum token";
    case "crypto-sol":
      return "Solana token";
    default:
      return "asset";
  }
}

export function buildSignalSummaryText(summary: SignalSummary): string {
  const directionText = summary.direction === "neutral"
    ? "balanced"
    : summary.direction;

  const [rangeMin, rangeMax] = (() => {
    const min = Math.abs(summary.expectedMovePctRange.min);
    const max = Math.abs(summary.expectedMovePctRange.max);
    if (summary.direction === "bearish") {
      return [-max, -min];
    }
    if (summary.direction === "neutral") {
      return [-min, max];
    }
    return [min, max];
  })();

  const moveText = `${formatPercent(rangeMin)} to ${formatPercent(rangeMax)}`;

  const stopLossText = typeof summary.stopLossPct === "number"
    ? `Typical risk-managed stop loss: around ${formatPercent(-Math.abs(summary.stopLossPct))}.`
    : "Maintain disciplined risk controls appropriate for your strategy.";

  const confidenceText = `Confidence: ${(summary.confidence * 100).toFixed(0)}%.`;

  return [
    `Aurora-Signals model is currently ${directionText} on ${summary.symbol} (${describeAssetClass(
      summary.assetClass
    )}) over the next ${summary.timeframe}.`,
    `The model estimates a probabilistic move of ${moveText} in this window.`,
    stopLossText,
    summary.rationale,
    confidenceText,
    SHORT_DISCLAIMER,
  ]
    .filter(Boolean)
    .join(" ");
}
