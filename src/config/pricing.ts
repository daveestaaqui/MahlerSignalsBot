export const TIERS = ['FREE','PRO','ELITE'] as const;
export type Tier = typeof TIERS[number];

export const PRICES = {
  PRO:   { monthly: 14 },
  ELITE: { monthly: 39 },
} as const;

export const FEATURES = {
  FREE:  { delayedHours: 24, alertsPerWeek: 3, api: false, webhooks: false, early: false, chains: [] as string[] },
  PRO:   { alertsPerDay: 30, api: false, webhooks: false, early: false, chains: ['SOL','ETH'] },
  ELITE: { alertsPerDay: Infinity, api: true, webhooks: true, early: true, chains: ['SOL','ETH'] },
} as const;

export const PRICE_MAP = {
  PRO_MONTHLY:   process.env.PRICE_PRO_MONTHLY   || 'price_pro_monthly_id',
  ELITE_MONTHLY: process.env.PRICE_ELITE_MONTHLY || 'price_elite_monthly_id',
} as const;

export const MONTHLY_PRO   = PRICES.PRO.monthly;
export const MONTHLY_ELITE = PRICES.ELITE.monthly;
