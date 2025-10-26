<<<<<<< Updated upstream
=======
import { daily } from '../adapters/alphaVantage';
import { sma, rvol, gapDown, gapUp, Bar } from './indicators';
>>>>>>> Stashed changes
import { scoreStock, stockUniq, SignalRecord } from '../../signals/rules.js';
import { TIERS } from '../../config/tiers.js';

const STOCK_MIN_SCORE = Number(process.env.STOCK_MIN_SCORE || 0.9);
const STOCK_ELITE_THRESHOLD = Number(process.env.STOCK_ELITE_THRESHOLD || 2.2);

type SampleDatum = {
  price: number;
  ma20: number;
  ma200: number;
  volume: number;
  avgVolume: number;
  gap: number;
  smartMoney: number;
  sentiment: number;
  policy: number;
};

const SAMPLE_DATA: Record<string, SampleDatum> = {
  AAPL: { price: 182.1, ma20: 188, ma200: 172, volume: 81000000, avgVolume: 56000000, gap: -1.8, smartMoney: 0.6, sentiment: 0.35, policy: 0.2 },
  MSFT: { price: 410.5, ma20: 415, ma200: 360, volume: 42000000, avgVolume: 30000000, gap: -0.6, smartMoney: 0.4, sentiment: 0.25, policy: 0.4 },
  NVDA: { price: 875.2, ma20: 860, ma200: 620, volume: 52000000, avgVolume: 40000000, gap: 0.5, smartMoney: 0.7, sentiment: 0.45, policy: 0.1 },
  TSLA: { price: 185.4, ma20: 195, ma200: 210, volume: 98000000, avgVolume: 89000000, gap: -2.3, smartMoney: 0.3, sentiment: 0.15, policy: 0.05 },
  META: { price: 512.3, ma20: 505, ma200: 415, volume: 28000000, avgVolume: 22000000, gap: 0.8, smartMoney: 0.45, sentiment: 0.32, policy: 0.25 },
  AMD:  { price: 174.8, ma20: 168, ma200: 138, volume: 95000000, avgVolume: 72000000, gap: -1.1, smartMoney: 0.55, sentiment: 0.29, policy: 0.18 },
};

function buildFeature(symbol: string): SampleDatum {
  return SAMPLE_DATA[symbol] || {
    price: 100,
    ma20: 102,
    ma200: 95,
    volume: 10_000_000,
    avgVolume: 8_000_000,
    gap: -0.5,
    smartMoney: 0.2,
    sentiment: 0.1,
    policy: 0.1,
  };
}

export async function runStocks(symbols: string[]): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now() / 1000);
  const signals: SignalRecord[] = [];

  for (const rawSymbol of symbols) {
    const symbol = rawSymbol.toUpperCase();
    const datum = buildFeature(symbol);
    const feature = {
      symbol,
      pct_from_20d: ((datum.price - datum.ma20) / datum.ma20) * 100,
      pct_from_200d: ((datum.price - datum.ma200) / datum.ma200) * 100,
      rvol: datum.avgVolume ? datum.volume / datum.avgVolume : 1,
      gapDown: datum.gap < -0.5,
      gapUp: datum.gap > 0.5,
      smartMoneyScore: datum.smartMoney,
      policyTailwind: datum.policy,
      sentiment: datum.sentiment,
    };

    const { score, reason } = scoreStock(feature);
    if (score < STOCK_MIN_SCORE) continue;

    const tier_min = score >= STOCK_ELITE_THRESHOLD ? 'elite' : 'pro';
    signals.push({
      symbol,
      asset_type: 'stock',
      score,
      reason,
      features: feature,
      tier_min,
      created_at: now,
      embargo_until: now + TIERS.free.delaySeconds,
      uniq_key: stockUniq(symbol, now, tier_min),
    });
  }

  return signals;
}
