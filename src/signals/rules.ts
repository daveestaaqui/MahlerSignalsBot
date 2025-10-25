export type StockFeature = {
  symbol: string;
  pct_from_20d: number;
  pct_from_200d: number;
  rvol: number;
  gapDown: boolean;
  gapUp: boolean;
  smartMoneyScore?: number;
  policyTailwind?: number;
  sentiment?: number;
};

export type SignalRecord = {
  symbol: string;
  asset_type: 'stock' | 'crypto';
  score: number;
  reason: string;
  features: Record<string, any>;
  tier_min: 'free' | 'pro' | 'elite';
  created_at: number;
  embargo_until?: number;
  uniq_key: string;
};

export function scoreStock(feature: StockFeature) {
  let score = 0;
  const notes: string[] = [];

  if (feature.gapDown && feature.rvol > 1.5) {
    score += 1.2;
    notes.push('gap-down capitulation + RVOL');
  }
  if (feature.pct_from_20d < -5) {
    score += 0.8;
    notes.push('mean reversion vs 20d');
  }
  if (feature.pct_from_200d > -15 && feature.pct_from_200d < 0) {
    score += 0.5;
    notes.push('support near 200d');
  }
  if ((feature.smartMoneyScore || 0) > 0.5) {
    score += 1.0;
    notes.push('smart money accumulation');
  }
  if ((feature.policyTailwind || 0) > 0.3) {
    score += 0.6;
    notes.push('policy tailwind');
  }
  if ((feature.sentiment || 0) > 0.2) {
    score += 0.3;
    notes.push('positive sentiment');
  }

  return {
    score,
    reason: notes.join(' • ') || 'composite score',
  };
}

export function stockUniq(symbol: string, epoch: number, rule = 'default') {
  const day = new Date(epoch * 1000).toISOString().slice(0, 10);
  return `${symbol}-${day}-${rule}`;
}
