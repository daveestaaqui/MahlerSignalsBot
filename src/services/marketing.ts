import TelegramBot from 'node-telegram-bot-api';

import type { DailyRunResult } from '../jobs/runDaily';
import { composePromo } from './templates';
import { buildTodaySignals, type SignalView } from '../domain/signals';
import { SHORT_DISCLAIMER } from '../lib/legal';
import { logInfo } from '../lib/logger';

type ChannelKey = 'telegram' | 'discord' | 'x';
export type ChannelFilters = Partial<Record<ChannelKey, boolean>>;

type ChannelDispatchResult = {
  channel: ChannelKey;
  attempted: boolean;
  ok: boolean;
  error?: string;
  skippedReason?: string;
  detail?: string;
};

type SendMarketingOptions = {
  template?: 'daily' | 'weekly';
  dryRun?: boolean;
  signals?: SignalView[];
  channels?: ChannelFilters;
};

export type MarketingSendResult = {
  ok: boolean;
  template: 'daily' | 'weekly';
  dryRun: boolean;
  summary: string;
  signals: number;
  channels: ChannelDispatchResult[];
};

const marketingTelegramChatId = (
  process.env.MARKETING_TELEGRAM_CHAT_ID ??
  process.env.TELEGRAM_CHAT_ID_FREE ??
  process.env.TELEGRAM_CHAT_ID_PRO ??
  process.env.TELEGRAM_CHAT_ID_ELITE ??
  ''
).trim();

const marketingDiscordWebhook = (
  process.env.MARKETING_DISCORD_WEBHOOK_URL ??
  process.env.DISCORD_WEBHOOK_URL ??
  ''
).trim();

const xAccessToken = (
  process.env.X_ACCESS_TOKEN ??
  process.env.X_BEARER_TOKEN ??
  ''
).trim();

const defaultDryRun =
  (process.env.MARKETING_DRY_RUN ?? process.env.DRY_RUN ?? '').toLowerCase() === 'true';

export async function autoPromoteSignals(result: DailyRunResult) {
  if (result.preview || result.dryRun || !result.postEnabled) return;
  await sendMarketingPosts(new Date(), { template: 'daily' });
}

export async function sendMarketingPosts(
  dateInput: Date | string,
  options: SendMarketingOptions = {},
): Promise<MarketingSendResult> {
  const dryRun = options.dryRun ?? defaultDryRun;
  const template = options.template ?? 'daily';
  const signals = options.signals ?? (await buildTodaySignals());
  const header = template === 'weekly' ? 'Weekly Desk Note' : 'Daily Highlights';
  const dateLabel =
    typeof dateInput === 'string'
      ? dateInput
      : dateInput.toISOString().slice(0, 10);

  const content = composePromo(
    signals.slice(0, 5).map((signal) => ({
      symbols: [signal.symbol],
      compact: `${signal.symbol} ${signal.timeframe}: ${sanitizeLine(signal.expectedMove)}`,
      plain: signal.rationale?.technical ?? '',
    })),
  );

  const payload = [
    `ManySignals Finance ${header} — ${dateLabel}`,
    content,
    '',
    SHORT_DISCLAIMER,
  ]
    .filter((line) => typeof line === 'string' && line.trim().length > 0)
    .join('\n');

  if (dryRun) {
    logInfo('marketing.send_preview', { template, dateLabel, preview: payload.slice(0, 140) });
    return {
      ok: true,
      template,
      dryRun: true,
      summary: payload,
      signals: signals.length,
      channels: [],
    };
  }

  const channelResults = await dispatchChannels(payload, options.channels);

  logInfo('marketing.sent', {
    template,
    dateLabel,
    signals: signals.length,
    channels: channelResults,
  });

  return {
    ok: true,
    template,
    dryRun: false,
    summary: payload,
    signals: signals.length,
    channels: channelResults,
  };
}

function sanitizeLine(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

async function dispatchChannels(
  content: string,
  filters?: ChannelFilters,
): Promise<ChannelDispatchResult[]> {
  const results: ChannelDispatchResult[] = [];
  const tasks: Array<Promise<ChannelDispatchResult>> = [];
  const map: Record<ChannelKey, () => Promise<ChannelDispatchResult>> = {
    telegram: () => sendMarketingTelegram(content),
    discord: () => sendMarketingDiscord(content),
    x: () => postToX(content),
  };

  (Object.keys(map) as ChannelKey[]).forEach((channel) => {
    if (!isChannelEnabled(channel, filters)) {
      results.push(channelSkip(channel, 'filtered_out'));
      return;
    }
    tasks.push(map[channel]());
  });

  const delivered = await Promise.all(tasks);
  return results.concat(delivered);
}

function isChannelEnabled(channel: ChannelKey, filters?: ChannelFilters): boolean {
  if (!filters) return true;
  const flag = filters[channel];
  if (typeof flag === 'undefined') return true;
  return Boolean(flag);
}

function channelSkip(channel: ChannelKey, reason: string, detail?: string): ChannelDispatchResult {
  logChannelSkip(channel, reason, detail);
  return {
    channel,
    attempted: false,
    ok: false,
    skippedReason: reason,
    detail,
  };
}

function logChannelSkip(channel: ChannelKey, reason: string, detail?: string) {
  logInfo('marketing.channel_skipped', { channel, reason, detail });
}

async function sendMarketingTelegram(content: string): Promise<ChannelDispatchResult> {
  if (!marketingTelegramChatId) {
    return channelSkip('telegram', 'not_configured', 'missing_chat_id');
  }
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!token) {
    return channelSkip('telegram', 'not_configured', 'missing_token');
  }
  try {
    const bot = new TelegramBot(token, { polling: false });
    await bot.sendMessage(marketingTelegramChatId, content, {
      disable_web_page_preview: true,
    });
    return { channel: 'telegram', attempted: true, ok: true };
  } catch (err) {
    const error = describeError(err);
    console.warn('[marketing:telegram] error', error);
    return { channel: 'telegram', attempted: true, ok: false, error };
  }
}

async function sendMarketingDiscord(content: string): Promise<ChannelDispatchResult> {
  if (!marketingDiscordWebhook) {
    return channelSkip('discord', 'not_configured', 'missing_webhook');
  }
  try {
    const response = await fetch(marketingDiscordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      const text = await response.text();
      const error = text ? text.slice(0, 200) : `http_${response.status}`;
      console.warn('[marketing:discord] failed', error);
      return { channel: 'discord', attempted: true, ok: false, error };
    }
    return { channel: 'discord', attempted: true, ok: true };
  } catch (err) {
    const error = describeError(err);
    console.warn('[marketing:discord] error', error);
    return { channel: 'discord', attempted: true, ok: false, error };
  }
}

async function postToX(content: string): Promise<ChannelDispatchResult> {
  if (!xAccessToken) {
    return channelSkip('x', 'not_configured', 'missing_token');
  }
  try {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${xAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    });
    if (!response.ok) {
      const text = await response.text();
      const error = text ? text.slice(0, 200) : `http_${response.status}`;
      console.warn('[marketing:x] failed', error);
      return { channel: 'x', attempted: true, ok: false, error };
    }
    return { channel: 'x', attempted: true, ok: true };
  } catch (err) {
    const error = describeError(err);
    console.warn('[marketing:x] error', error);
    return { channel: 'x', attempted: true, ok: false, error };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'unknown_error';
}
