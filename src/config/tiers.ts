export type Tier = 'free'|'pro'|'elite';
export const TIER_GATES = {
  free:  { delaySeconds: 24*3600, crypto: false, stocks: true, whale: false, congress: false, options: false },
  pro:   { delaySeconds: 0,        crypto: true,  stocks: true, whale: true,  congress: true,  options: false },
  elite: { delaySeconds: 0,        crypto: true,  stocks: true, whale: true,  congress: true,  options: true  },
} as const;
export const FEATURES = {
  DRY_RUN: process.env.DRY_RUN === 'true',
  POST_ENABLED: process.env.POST_ENABLED === 'true',
};
