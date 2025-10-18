export type Tier = 'FREE' | 'PRO' | 'ELITE';

export const MONTHLY_PRO = 14;
export const YEARLY_PRO = 140;
export const MONTHLY_ELITE = 39;
export const YEARLY_ELITE = 390;

export const PRICE = {
  PRO: { monthly: MONTHLY_PRO, yearly: YEARLY_PRO },
  ELITE: { monthly: MONTHLY_ELITE, yearly: YEARLY_ELITE },
} as const;

export const FEATURES = {
  FREE: {
    delayedHours: 24,
    alertsPerWeek: 3,
    api: false,
    webhooks: false,
    early: false,
  },
  PRO: {
    alertsPerDay: 30,
    api: false,
    webhooks: false,
    early: false,
    chains: ['SOL', 'ETH'],
  },
  ELITE: {
    alertsPerDay: Infinity,
    api: true,
    webhooks: true,
    early: true,
    chains: ['SOL', 'ETH'],
  },
} as const;

export const TIERS: Tier[] = ['FREE', 'PRO', 'ELITE'];
