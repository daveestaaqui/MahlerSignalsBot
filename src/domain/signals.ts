export const AURORA_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.";

export type AssetClass = "stock" | "crypto-eth" | "crypto-sol";
export type Direction = "long-bias" | "short-bias" | "range" | "neutral-watch";

export interface MoveRange {
  directionLabel: string;
  minPct?: number;
  maxPct?: number;
  timeframeLabel: string;
}

export interface StopLossZone {
  label: string;
  levelHint?: string;
  commentary?: string;
}

export interface AuroraSignal {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  venue?: string;
  direction: Direction;
  timeframeLabel: string;
  moveRange?: MoveRange;
  stopLossZone?: StopLossZone;
  technicalRationale?: string;
  fundamentalRationale?: string;
  riskNotes?: string[];
  tags?: string[];
  disclaimer?: string;
}

export interface TodaySignalsResponse {
  asOf: string;
  universeNote: string;
  signals: AuroraSignal[];
  disclaimer: string;
}

const SAMPLE_SIGNALS: Omit<AuroraSignal, "id">[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    assetClass: "stock",
    venue: "NASDAQ",
    direction: "long-bias",
    timeframeLabel: "2–5 trading days",
    moveRange: {
      directionLabel: "Upside scenario",
      minPct: 3,
      maxPct: 6,
      timeframeLabel: "over the next 2–5 trading days",
    },
    stopLossZone: {
      label: "Invalidation below",
      levelHint: "$118 area",
      commentary: "fails if price closes back inside the prior gap",
    },
    technicalRationale:
      "Price is consolidating just above a breakout gap with rising 21-day EMA support and subdued intraday volatility.",
    fundamentalRationale:
      "Data-center demand and AI accelerator commentary remain constructive, keeping consensus estimates elevated.",
    riskNotes: [
      "High sensitivity to macro tech flows.",
      "Gap risk around earnings or regulatory news.",
    ],
    tags: ["momentum", "mega-cap"],
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    assetClass: "stock",
    venue: "NASDAQ",
    direction: "long-bias",
    timeframeLabel: "1–4 trading days",
    moveRange: {
      directionLabel: "Upside scenario",
      minPct: 2,
      maxPct: 4,
      timeframeLabel: "over the next 1–4 trading days",
    },
    stopLossZone: {
      label: "Risk control near",
      levelHint: "$412",
      commentary: "below short-term support",
    },
    technicalRationale:
      "Shares hold above a breakout shelf with relative strength versus the S&P 500 at multi-week highs.",
    fundamentalRationale:
      "Cloud and AI workloads continue to support double-digit top-line growth while margins remain firm.",
    riskNotes: [
      "Scenario may fail if enterprise demand weakens or macro data disappoints.",
    ],
    tags: ["quality", "large-cap"],
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    assetClass: "stock",
    venue: "NASDAQ",
    direction: "range",
    timeframeLabel: "3–7 trading days",
    moveRange: {
      directionLabel: "Range scenario",
      minPct: -4,
      maxPct: 7,
      timeframeLabel: "while it oscillates around $210 support",
    },
    stopLossZone: {
      label: "Invalidation below",
      levelHint: "$205",
      commentary: "range breaks if daily close is below this zone",
    },
    technicalRationale:
      "Price is respecting a horizontal range with buyers stepping in near the 21-day moving average.",
    fundamentalRationale:
      "Services and energy segments help smooth hardware volatility, but margins remain sensitive to pricing.",
    riskNotes: [
      "Range setups can fail quickly if momentum resumes in either direction.",
    ],
  },
  {
    symbol: "ETH/USDT",
    name: "Ethereum",
    assetClass: "crypto-eth",
    venue: "Ethereum",
    direction: "long-bias",
    timeframeLabel: "1–4 days",
    moveRange: {
      directionLabel: "Upside scenario",
      minPct: 5,
      maxPct: 8,
      timeframeLabel: "over the next 1–4 days",
    },
    stopLossZone: {
      label: "De-risk below",
      levelHint: "$3.4k",
      commentary: "if price loses recent higher low",
    },
    technicalRationale:
      "ETH continues to print higher highs on the 4h chart with intraday pullbacks bought near VWAP.",
    fundamentalRationale:
      "Layer-2 activity, staking inflows, and ETF chatter have supported demand in recent weeks.",
    riskNotes: [
      "Regulatory news or macro volatility can derail the setup quickly.",
      "Crypto assets carry materially higher gap risk than equities.",
    ],
    tags: ["layer-1", "staking"],
  },
  {
    symbol: "ARB/USDT",
    name: "Arbitrum",
    assetClass: "crypto-eth",
    venue: "Ethereum",
    direction: "long-bias",
    timeframeLabel: "2–6 days",
    moveRange: {
      directionLabel: "Upside scenario",
      minPct: 6,
      maxPct: 10,
      timeframeLabel: "if the breakout flag resolves higher over 2–6 days",
    },
    stopLossZone: {
      label: "Back off below",
      levelHint: "$1.05",
      commentary: "invalidates the higher-low structure",
    },
    technicalRationale:
      "ARB is coiling just under resistance with declining realized volatility, a pattern that can precede range expansion.",
    fundamentalRationale:
      "Ecosystem incentives and rollup adoption metrics show steady growth, keeping TVL trends constructive.",
    riskNotes: [
      "Token unlock headlines or risk-off crypto flows can negate the setup.",
    ],
    tags: ["layer-2", "momentum"],
  },
  {
    symbol: "SOL/USDT",
    name: "Solana",
    assetClass: "crypto-sol",
    venue: "Solana",
    direction: "long-bias",
    timeframeLabel: "5–10 days",
    moveRange: {
      directionLabel: "Upside scenario",
      minPct: 8,
      maxPct: 12,
      timeframeLabel: "within 5–10 days",
    },
    stopLossZone: {
      label: "Watch below",
      levelHint: "$146",
      commentary: "breaks the consolidating wedge",
    },
    technicalRationale:
      "SOL has been compressing in a tight range with falling realized volatility, often preceding expansion moves.",
    fundamentalRationale:
      "Fee revenue and DEX activity are trending higher while new launches attract liquidity.",
    riskNotes: [
      "Breakdown risk increases if broader crypto sentiment turns risk-off.",
    ],
  },
  {
    symbol: "JUP/USDC",
    name: "Jupiter",
    assetClass: "crypto-sol",
    venue: "Solana",
    direction: "neutral-watch",
    timeframeLabel: "1–3 weeks",
    moveRange: {
      directionLabel: "Watchlist scenario",
      minPct: -6,
      maxPct: 9,
      timeframeLabel: "as it bases for a potential secondary move",
    },
    stopLossZone: {
      label: "Invalidation on",
      levelHint: "loss of $0.85",
      commentary: "confirms breakdown from accumulation range",
    },
    technicalRationale:
      "JUP is digesting its prior rally with lower volume pullbacks and support holding near the 50% retracement.",
    fundamentalRationale:
      "Aggregator volumes remain elevated and DAO incentive discussions could add catalysts, but timelines are uncertain.",
    riskNotes: [
      "Token remains young; liquidity pockets can thin out quickly.",
    ],
    tags: ["watchlist", "high-beta"],
  },
  {
    symbol: "MARA",
    name: "Marathon Digital",
    assetClass: "stock",
    venue: "NASDAQ",
    direction: "short-bias",
    timeframeLabel: "1–3 trading days",
    moveRange: {
      directionLabel: "Downside scenario",
      minPct: -5,
      maxPct: -9,
      timeframeLabel: "over the next few sessions",
    },
    stopLossZone: {
      label: "Cap risk above",
      levelHint: "$23",
      commentary: "recent swing high",
    },
    technicalRationale:
      "After a parabolic run, price is failing to reclaim the 10-day average and printing lower highs with heavy down-volume.",
    fundamentalRationale:
      "Margins remain sensitive to energy costs and BTC swings; leverage metrics higher than diversified peers.",
    riskNotes: [
      "Any renewed BTC breakout can squeeze the short quickly.",
      "Borrow availability may tighten if volatility spikes.",
    ],
    tags: ["miners", "high-volatility"],
  },
];

export function buildIllustrativeTodaySignals(now: Date = new Date()): TodaySignalsResponse {
  const asOf = now.toISOString();
  const signals = SAMPLE_SIGNALS.map((signal, idx) => ({
    ...signal,
    id: `${signal.symbol}-${idx}`,
    disclaimer: signal.disclaimer ?? AURORA_DISCLAIMER,
  }));

  return {
    asOf,
    universeNote: "US equities plus Ethereum & Solana majors scanned for liquidity and momentum cues",
    signals,
    disclaimer: AURORA_DISCLAIMER,
  };
}
