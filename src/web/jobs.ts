
import { buildDailyAnalysis, buildMarketingPosts } from '../logic/analysis';
import { sendTelegram } from '../integrations/telegram';
import { sendDiscord } from '../integrations/discord';
import { sendMastodon } from '../integrations/mastodon';

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
  const { text } = await buildDailyAnalysis();
  const mk = buildMarketingPosts();
  const payload = [text, '', mk.telegram].join('\n');
  if (dryRun) {
    return [{ ok: true, dryRun: true, preview: payload }];
  }
  const out: any[] = [];
  out.push(await sendTelegram(payload));
  out.push(await sendDiscord(payload));
  out.push(await sendMastodon(payload));
  return out;
}

export type PostDailyOptions = {
  dryRun?: BooleanLike;
};

export async function postDaily(options?: PostDailyOptions | boolean) {
  const dryRun = toBoolean(typeof options === 'boolean' ? options : options?.dryRun, false);
  const { text } = await buildDailyAnalysis();
  const mk = buildMarketingPosts();
  const msg = [text, '', mk.discord].join('\n');
  if (dryRun) {
    return [{ ok: true, dryRun: true, preview: msg }];
  }
  const out: any[] = [];
  out.push(await sendTelegram(msg));
  out.push(await sendDiscord(msg));
  out.push(await sendMastodon(msg));
  return out;
}

export async function marketingBlast(topic?: string, options?: { dryRun?: BooleanLike }) {
  const dryRun = toBoolean(options?.dryRun, false);
  const { text } = await buildDailyAnalysis();
  const mk = buildMarketingPosts();
  const header = topic && topic.trim() ? `${topic.trim()}\n` : '';
  const payload = [header + text, '', mk.telegram].join('\n');
  if (dryRun) {
    return [{ ok: true, dryRun: true, preview: payload }];
  }
  const out: any[] = [];
  out.push(await sendTelegram(payload));
  out.push(await sendDiscord(payload));
  out.push(await sendMastodon(payload));
  return out;
}
