export const TIERS = ['FREE','PRO','ELITE'] as const;
export type Tier = typeof TIERS[number];
export const PRICES = { PRO:{monthly:14,yearly:140}, ELITE:{monthly:39,yearly:390} } as const;
export const FEATURES = {
  FREE:{delayedHours:24,alertsPerWeek:3,api:false,webhooks:false,early:false,chains:[] as string[]},
  PRO:{alertsPerDay:30,api:false,webhooks:false,early:false,chains:['SOL','ETH'] as const},
  ELITE:{alertsPerDay:Infinity,api:true,webhooks:true,early:true,chains:['SOL','ETH'] as const},
} as const;
export const MONTHLY_PRO=PRICES.PRO.monthly;
export const YEARLY_PRO=PRICES.PRO.yearly;
export const MONTHLY_ELITE=PRICES.ELITE.monthly;
export const YEARLY_ELITE=PRICES.ELITE.yearly;
