import { CADENCE } from './cadence.js';

const dailyCap = Number(process.env.DAILY_POST_CAP ?? '4');
const minScorePro = Number(process.env.MIN_SCORE_PRO ?? '0.85');
const minScoreElite = Number(process.env.MIN_SCORE_ELITE ?? '0.90');
const cooldownDays = Number(process.env.COOLDOWN_DAYS ?? '3');
const flowUsdMin = Number(process.env.FLOW_USD_MIN ?? '2000000');

export const POSTING_RULES = {
  DAILY_POST_CAP: Number.isFinite(dailyCap) && dailyCap > 0 ? dailyCap : 2,
  MIN_SCORE_PRO: Number.isFinite(minScorePro) ? minScorePro : 0.85,
  MIN_SCORE_ELITE: Number.isFinite(minScoreElite) ? minScoreElite : 0.9,
  COOLDOWN_SECONDS: (Number.isFinite(cooldownDays) ? cooldownDays : 3) * 24 * 3600,
  FLOW_USD_MIN: Number.isFinite(flowUsdMin) && flowUsdMin > 0 ? flowUsdMin : 2_000_000,
};
const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export const POSTING_ENV = {
  DRY_RUN: toBool(process.env.DRY_RUN, false),
  POST_ENABLED: toBool(process.env.POST_ENABLED, true),
  MIN_SCORE_PRO: POSTING_RULES.MIN_SCORE_PRO,
  DAILY_POST_CAP: POSTING_RULES.DAILY_POST_CAP,
  MAX_POSTS_PER_DAY: CADENCE.MAX_POSTS_PER_DAY,
  TZ: CADENCE.TIMEZONE,
  PROMO_ENABLED: toBool(process.env.PROMO_ENABLED, false),
  PROMO_X_ENABLED: toBool(process.env.PROMO_X_ENABLED, false),
  PROMO_DISCORD_ENABLED: toBool(process.env.PROMO_DISCORD_ENABLED, false),
  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN ?? '',
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ?? '',
} as const;
