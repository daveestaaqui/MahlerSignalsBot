export const SHORT_DISCLAIMER =
  "This system provides automated market analysis and education only and does not provide personalized financial, investment, or trading advice. Past performance is not indicative of future results.";

export type SignalAssetType = "stock" | "crypto";
export type SignalNetwork = "NYSE" | "NASDAQ" | "ETH" | "SOL" | "OTHER";
export type SignalTimeframe = "intra-day" | "1-3 days" | "1-2 weeks" | "1-3 months";
export type SignalRiskLevel = "low" | "medium" | "high";

export interface PriceBand {
  min?: number;
  max?: number;
  note?: string;
}

export interface LevelNote {
  level: number;
  note?: string;
}

export interface TargetGainRange {
  minPercent: number;
  maxPercent: number;
  note?: string;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  assetType: SignalAssetType;
  network: SignalNetwork;
  timeframe: SignalTimeframe;
  entry: PriceBand;
  stopLoss: LevelNote;
  targetGainRange: TargetGainRange;
  risk: SignalRiskLevel;
  confidence: number;
  rationale: string;
}

export function buildSampleSignals(now: Date = new Date()): Signal[] {
  const iso = now.toISOString().slice(0, 10);
  return [
    {
      id: `AAPL-${iso}`,
      symbol: "AAPL",
      name: "Apple Inc.",
      assetType: "stock",
      network: "NASDAQ",
      timeframe: "1-3 months",
      entry: { min: 172, max: 178, note: "accumulation near rising 50-day average" },
      stopLoss: { level: 166, note: "below March swing low" },
      targetGainRange: {
        minPercent: 8,
        maxPercent: 14,
        note: "if services-led margin support continues (not guaranteed)",
      },
      risk: "medium",
      confidence: 74,
      rationale:
        "Shares remain in an eight-week uptrend with buyers defending the 50-day moving average and steady volume on advances. Services revenue growth, resilient iPhone upgrade demand, and renewed buyback authorization provide fundamental support if macro conditions stay stable. Price continues to base above prior resistance near $170, suggesting constructive sentiment if this zone holds. Target gain range requires the current trend to persist and is not guaranteed.",
    },
    {
      id: `MSFT-${iso}`,
      symbol: "MSFT",
      name: "Microsoft Corp.",
      assetType: "stock",
      network: "NASDAQ",
      timeframe: "1-2 weeks",
      entry: { min: 401, max: 408, note: "pullbacks into 21-day EMA" },
      stopLoss: { level: 392, note: "below breakout pivot" },
      targetGainRange: {
        minPercent: 5,
        maxPercent: 9,
        note: "if AI-related demand keeps EPS revisions trending higher; not guaranteed",
      },
      risk: "low",
      confidence: 80,
      rationale:
        "Momentum rebuilt after the latest earnings update with cloud and AI commentary pushing consensus estimates higher. Price is carving higher lows above the 21-day EMA, and relative strength versus the S&P 500 is at three-month highs. Liquidity remains deep, allowing position adds on orderly pullbacks. Target gain range depends on buyers defending near-term support and remains uncertain.",
    },
    {
      id: `ETH-${iso}`,
      symbol: "ETH-USD",
      name: "Ethereum",
      assetType: "crypto",
      network: "ETH",
      timeframe: "1-3 days",
      entry: { min: 3400, max: 3480, note: "intraday dips into VWAP" },
      stopLoss: { level: 3290, note: "invalidate if 4-hour structure breaks" },
      targetGainRange: {
        minPercent: 6,
        maxPercent: 12,
        note: "assuming breakout toward prior December highs; not guaranteed",
      },
      risk: "high",
      confidence: 63,
      rationale:
        "ETH is holding a series of higher lows on the four-hour chart with funding near neutral, suggesting leveraged positioning is balanced. L2 throughput and staking flows remain elevated following the latest upgrade, supporting the demand backdrop. Immediate resistance sits near $3.7k; a sustained move above that zone could trigger follow-through if spot buyers stay active. The scenario depends on crypto-wide risk appetite and can fail quickly.",
    },
    {
      id: `SOL-${iso}`,
      symbol: "SOL-USD",
      name: "Solana",
      assetType: "crypto",
      network: "SOL",
      timeframe: "1-2 weeks",
      entry: { min: 150, max: 158, note: "range-low accumulations" },
      stopLoss: { level: 142, note: "break of consolidating wedge" },
      targetGainRange: {
        minPercent: 10,
        maxPercent: 18,
        note: "continuation toward $180 if volume expands; outcome uncertain",
      },
      risk: "high",
      confidence: 58,
      rationale:
        "SOL has spent two weeks compressing between $150 and $165 with declining realized volatility, often preceding impulse moves. On-chain program deployments and DEX volume both ticked higher last week, hinting at renewed builder activity. Bulls want to see daily closes above $165 with rising volume to confirm a breakout, but rejection would invalidate quickly. Position sizing should reflect the elevated risk and the fact that targets are illustrative only.",
    },
    {
      id: `NVDA-${iso}`,
      symbol: "NVDA",
      name: "NVIDIA Corp.",
      assetType: "stock",
      network: "NASDAQ",
      timeframe: "intra-day",
      entry: { note: "monitor breakout retests near open" },
      stopLoss: { level: 116, note: "below Tuesday gap fill" },
      targetGainRange: {
        minPercent: 3,
        maxPercent: 6,
        note: "for day-traders if breakout holds; not guaranteed",
      },
      risk: "high",
      confidence: 52,
      rationale:
        "Shares gapped higher on strong GPU demand commentary, and early volume surged to twice the 10-day average. Intraday trend support near $118 has been defended repeatedly; losing that level would suggest momentum is cooling. Options flow remains call-heavy, which can cut both ways if market-wide volatility spikes. This intra-day setup is only for nimble traders who can honor stops quickly.",
    },
  ];
}
