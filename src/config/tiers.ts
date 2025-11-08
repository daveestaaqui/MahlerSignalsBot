import { CADENCE } from './cadence';

export type Tier = 'free'|'pro'|'elite';
export const TIER_GATES = {
  free:  { delaySeconds: 24*3600, crypto: false, stocks: true, whale: false, congress: false, options: false, cryptoMajorsOnly: true },
  pro:   { delaySeconds: 0,        crypto: true,  stocks: true, whale: true,  congress: true,  options: false, cryptoMajorsOnly: true },
  elite: { delaySeconds: 0,        crypto: true,  stocks: true, whale: true,  congress: true,  options: true,  cryptoMajorsOnly: false  },
} as const;
export const TIERS = TIER_GATES;
export const FEATURES = {
  DRY_RUN: process.env.DRY_RUN === 'true',
  POST_ENABLED: process.env.POST_ENABLED === 'true',
};

export const CRYPTO_MAJORS = new Set<string>(CADENCE.CRYPTO_MAJOR_SYMBOLS);
