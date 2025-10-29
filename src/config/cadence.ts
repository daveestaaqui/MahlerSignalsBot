const maxPosts = Number(process.env.MAX_POSTS_PER_DAY ?? '4');
const enableStocksDaily = (process.env.ENABLE_STOCKS_DAILY ?? 'true').toLowerCase() === 'true';
const enableCryptoDaily = (process.env.ENABLE_CRYPTO_DAILY ?? 'true').toLowerCase() === 'true';
const weeklySummaryDay = (process.env.WEEKLY_SUMMARY_DAY ?? 'SUN').toUpperCase();
const timezone = process.env.TZ || 'America/New_York';
const cryptoMajorsEnv = process.env.CRYPTO_MAJOR_SYMBOLS ?? 'BTC,ETH,SOL';

export const CADENCE = {
  MAX_POSTS_PER_DAY: Number.isFinite(maxPosts) && maxPosts > 0 ? Math.floor(maxPosts) : 2,
  ENABLE_STOCKS_DAILY: enableStocksDaily,
  ENABLE_CRYPTO_DAILY: enableCryptoDaily,
  WEEKLY_SUMMARY_DAY: weeklySummaryDay,
  TIMEZONE: timezone,
  CRYPTO_MAJOR_SYMBOLS: cryptoMajorsEnv
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0),
} as const;

export type CadenceAssetClass = 'stock' | 'crypto';

export function todayIso(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
