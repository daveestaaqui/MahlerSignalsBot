import { CRYPTO_MAJORS, TIER_GATES } from '../config/tiers';

type AssetClass = 'stock' | 'crypto';
type Tier = 'free' | 'pro' | 'elite';

type Dimension = {
  asset: AssetClass;
  symbol?: string;
  whale?: boolean;
  congress?: boolean;
  options?: boolean;
};

export function canPublish(tier: Tier, dimension: Dimension): boolean {
  const gate = TIER_GATES[tier];
  if (!gate) return false;

  if (dimension.asset === 'crypto') {
    if (!gate.crypto) return false;
    if (gate.cryptoMajorsOnly) {
      const symbol = dimension.symbol?.toUpperCase();
      if (!symbol || !CRYPTO_MAJORS.has(symbol)) {
        return false;
      }
    }
  }

  if (dimension.asset === 'stock' && !gate.stocks) {
    return false;
  }

  if (dimension.whale && !gate.whale) return false;
  if (dimension.congress && !gate.congress) return false;
  if (dimension.options && !gate.options) return false;

  return true;
}
