import { sendMarketingPosts, type ChannelFilters, type MarketingSendResult } from '../services/marketing';

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

type BaseJobOptions = {
  dryRun?: BooleanLike;
  channels?: ChannelFilters;
};

export type PostNowOptions = {
  dryRun?: BooleanLike;
  channels?: ChannelFilters;
};

export async function postNow(options: PostNowOptions = {}): Promise<MarketingSendResult> {
  const dryRun = toBoolean(options.dryRun, false);
  return sendMarketingPosts(new Date(), {
    dryRun,
    template: 'daily',
    channels: options.channels,
  });
}

export type PostDailyOptions = BaseJobOptions & {
  template?: 'daily' | 'weekly';
};

export async function postDaily(options?: PostDailyOptions | boolean): Promise<MarketingSendResult> {
  const dryRun = toBoolean(typeof options === 'boolean' ? options : options?.dryRun, false);
  const channels = typeof options === 'boolean' ? undefined : options?.channels;
  const template = typeof options === 'boolean' ? 'daily' : options?.template ?? 'daily';
  return sendMarketingPosts(new Date(), { dryRun, template, channels });
}

export type MarketingBlastOptions = BaseJobOptions & {
  template?: 'daily' | 'weekly';
};

export async function marketingBlast(
  topic?: string,
  options?: MarketingBlastOptions,
): Promise<MarketingSendResult> {
  const dryRun = toBoolean(options?.dryRun, false);
  const pivot = topic?.trim() || new Date();
  const template = options?.template ?? 'daily';
  return sendMarketingPosts(pivot, {
    dryRun,
    template,
    channels: options?.channels,
  });
}
