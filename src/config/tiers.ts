export const TIERS = {
  free:  { name: 'FREE',  stocks: true,  crypto: false, delaySeconds: 24 * 3600 },
  pro:   { name: 'PRO',   stocks: true,  crypto: false, delaySeconds: 0, extras: true },
  elite: { name: 'ELITE', stocks: true,  crypto: true,  delaySeconds: 0, extras: true },
} as const;

export type TierKey = keyof typeof TIERS;

export const TELEGRAM = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  free:  process.env.TELEGRAM_CHAT_ID_FREE,
  pro:   process.env.TELEGRAM_CHAT_ID_PRO,
  elite: process.env.TELEGRAM_CHAT_ID_ELITE,
} as const;
