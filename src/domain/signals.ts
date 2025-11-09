export const SIGNAL_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";

export type AssetClass = "stock" | "crypto";
export type Chain = "ethereum" | "solana";

export interface SignalRationale {
  technical: string;
  fundamental: string;
}

export interface SignalPayload {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  chain?: Chain;
  timeframe: string;
  expectedMove: string;
  stopLossHint?: string;
  rationale: SignalRationale;
  riskNote: string;
  disclaimer: string;
}

export interface SignalResponse {
  ok: true;
  ts: number;
  signals: SignalPayload[];
}

const SAMPLE_SIGNALS: Omit<SignalPayload, "id">[] = [
  {
    symbol: "AAPL",
    assetClass: "stock",
    timeframe: "next 1–3 days",
    expectedMove:
      "Potential upside in the 3–6% range over the next 1–3 days if buyers continue to defend the rising 21-day average; scenarios are not guaranteed.",
    stopLossHint:
      "Illustrative stop below $207, near the most recent swing low; position sizing remains the primary risk control.",
    rationale: {
      technical:
        "Price is respecting a shallow pullback pattern with rising short-term moving averages and constructive up-day volume.",
      fundamental:
        "Services and wearables growth steady out hardware cycles, and margin commentary last quarter remained supportive.",
    },
    riskNote:
      "Macro risk-off headlines or supply-chain surprises can quickly invalidate the scenario; manage exposure tightly.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "MSFT",
    assetClass: "stock",
    timeframe: "next 3–5 days",
    expectedMove:
      "Potential upside of roughly 4–7% over the next few sessions if the base above $420 holds; outcomes remain uncertain.",
    stopLossHint:
      "Scenario watchers often reassess on a daily close back below $415, which would signal failed support.",
    rationale: {
      technical:
        "Shares continue to build a tight flag above a prior breakout shelf with relative strength versus the S&P 500.",
      fundamental:
        "Cloud and AI workload demand keeps consensus revenue revisions trending higher, lending support to sentiment.",
    },
    riskNote:
      "Any slowdown in enterprise spending or sudden rate shocks may pressure large-cap tech broadly.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "NVDA",
    assetClass: "stock",
    timeframe: "next 1–2 weeks",
    expectedMove:
      "Potential upside in the 8–15% range over the next 1–2 weeks if data-center demand headlines stay constructive.",
    stopLossHint:
      "Illustrative stop below the $118 gap fill, which would indicate the momentum structure is failing.",
    rationale: {
      technical:
        "Higher lows continue to hold above the rising 21-day EMA, while volume expands on up moves.",
      fundamental:
        "AI accelerator backlogs, strong data-center visibility, and raised guidance underpin the bullish narrative.",
    },
    riskNote:
      "High beta name with gap risk around earnings or policy headlines; plan for volatility and slippage.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "BTC/USDT",
    assetClass: "crypto",
    chain: "ethereum",
    timeframe: "next 3–7 days",
    expectedMove:
      "Potential move of +6–10% in the next week if BTC continues to hold its higher-low structure; crypto swings remain uncertain.",
    stopLossHint:
      "Watch for a daily close below the 50-day MA / recent $64k pivot as an illustrative invalidation level.",
    rationale: {
      technical:
        "BTC is printing a series of higher lows with declining realized volatility, a setup that can precede trend continuation.",
      fundamental:
        "ETF inflows remain positive and on-chain settlements continue to climb, though macro risk can override quickly.",
    },
    riskNote:
      "Crypto assets exhibit gap risk and trade 24/7; ensure any scenario uses disciplined sizing.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "ETH/USDT",
    assetClass: "crypto",
    chain: "ethereum",
    timeframe: "next 2–5 days",
    expectedMove:
      "Potential upside of 5–9% over the next few days if the rising channel remains intact; moves are never guaranteed.",
    stopLossHint:
      "Illustrative stop just below $3.4k to acknowledge the most recent higher low; adjust for volatility tolerance.",
    rationale: {
      technical:
        "ETH keeps respecting a rising 4-hour channel with pullbacks bought near VWAP and momentum oscillators mid-range.",
      fundamental:
        "Layer-2 activity, staking inflows, and institutional interest underpin demand, but regulatory headlines can shift tone quickly.",
    },
    riskNote:
      "ETH can move sharply on macro headlines; traders should allow for whipsaws and liquidity skews.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "SOL/USDC",
    assetClass: "crypto",
    chain: "solana",
    timeframe: "next 5–10 days",
    expectedMove:
      "Potential upside scenario of 7–12% over the next 5–10 days if the compression range resolves higher; results vary.",
    stopLossHint:
      "Consider trimming if price closes decisively below $146, which would signal the wedge is breaking down.",
    rationale: {
      technical:
        "SOL has been coiling with falling realized volatility, a structure that often precedes range expansion.",
      fundamental:
        "On-chain fees, DEX volumes, and new launches remain constructive, supporting the network adoption case.",
    },
    riskNote:
      "Breakdowns accelerate quickly in high-beta tokens; liquidity can thin out during risk-off sessions.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "MARA",
    assetClass: "stock",
    timeframe: "next 1–3 days",
    expectedMove:
      "Potential downside of roughly 5–9% if BTC stalls near resistance and miners cool off; squeezes remain possible.",
    stopLossHint:
      "Illustrative cap near $23, above the recent swing high, to respect squeeze risk if momentum reignites.",
    rationale: {
      technical:
        "After a parabolic move, MARA is failing to reclaim the 10-day moving average and is printing lower highs with heavy down-day volume.",
      fundamental:
        "Margins remain sensitive to energy inputs and BTC beta; leverage metrics run higher than diversified peers.",
    },
    riskNote:
      "Short setups carry gap and borrow risk; scenario is invalidated quickly on renewed BTC upside.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
  {
    symbol: "SOL/USDT-PERP",
    assetClass: "crypto",
    chain: "solana",
    timeframe: "next 1–2 weeks",
    expectedMove:
      "Potential move of ±10% as the pair retests range extremes; this is a mean-reversion watch more than a high conviction trade.",
    stopLossHint:
      "Hypothetical stop near the upper edge of the consolidation range to limit losses if momentum accelerates.",
    rationale: {
      technical:
        "Perp funding has normalized while price oscillates between well-defined support and resistance, hinting at range trading conditions.",
      fundamental:
        "No strong fundamental view, scenario is primarily technical and liquidity-driven.",
    },
    riskNote:
      "Perpetual swaps can move faster than spot; funding flips and liquidity pockets introduce additional risk.",
    disclaimer: SIGNAL_DISCLAIMER,
  },
];

export function buildTodaySignals(now: Date = new Date()): SignalResponse {
  const ts = now.getTime();
  const signals = SAMPLE_SIGNALS.map((signal, index) => ({
    ...signal,
    id: `${signal.symbol}-${index}`,
  }));

  return {
    ok: true,
    ts,
    signals,
  };
}
