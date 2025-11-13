
import { sendMarketingPosts } from '../services/marketing';

type BooleanLike = boolean | string | number | undefined | null;

const toBoolean = (value: BooleanLike, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

export type PostNowOptions = {
  dryRun?: BooleanLike;
};

export async function postNow(options: PostNowOptions = {}) {
  const dryRun = toBoolean(options.dryRun, false);
  const result = await sendMarketingPosts(new Date(), { dryRun, template: 'daily' });
  return [result];
}

export type PostDailyOptions = {
  dryRun?: BooleanLike;
};

export async function postDaily(options?: PostDailyOptions | boolean) {
  const dryRun = toBoolean(typeof options === 'boolean' ? options : options?.dryRun, false);
  const result = await sendMarketingPosts(new Date(), { dryRun, template: 'daily' });
  return [result];
}

export async function marketingBlast(topic?: string, options?: { dryRun?: BooleanLike }) {
  const dryRun = toBoolean(options?.dryRun, false);
  const pivot = topic?.trim() || new Date();
  const result = await sendMarketingPosts(pivot, {
    dryRun,
    template: 'daily',
  });
  return [result];
}
