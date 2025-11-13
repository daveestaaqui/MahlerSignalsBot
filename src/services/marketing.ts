import TelegramBot from 'node-telegram-bot-api';

import type { DailyRunResult } from '../jobs/runDaily';
import { dispatchToDiscord } from '../posters/discord';
import { composePromo } from './templates';
import { promoteAll } from './promo';
import { buildTodaySignals, type SignalView } from '../domain/signals';
import { SHORT_DISCLAIMER } from '../lib/legal';
import { logInfo } from '../lib/logger';

const marketingTelegramChatId =
  process.env.MARKETING_TELEGRAM_CHAT_ID ??
  process.env.TELEGRAM_CHAT_ID_FREE ??
  process.env.TELEGRAM_CHAT_ID_PRO ??
  process.env.TELEGRAM_CHAT_ID_ELITE ??
  '';
const marketingDiscordWebhook =
  process.env.MARKETING_DISCORD_WEBHOOK_URL ??
  process.env.DISCORD_WEBHOOK_URL ??
  '';
const xAccessToken = process.env.X_ACCESS_TOKEN ?? '';

export async function autoPromoteSignals(result: DailyRunResult) {
  if (result.preview || result.dryRun || !result.postEnabled) return;
  if (!result.messages?.length) return;

  const summary = buildSignalSummary(result);
  await Promise.allSettled([
    promoteAll(summary),
    sendMarketingTelegram(summary),
    sendMarketingDiscord(summary),
    postToX(summary),
  ]);
}

export function buildSignalSummary(result: DailyRunResult) {
  return composePromo(result);
}

type SendMarketingOptions = {
  template?: 'daily' | 'weekly';
  dryRun?: boolean;
  signals?: SignalView[];
};

const defaultDryRun =
  (process.env.MARKETING_DRY_RUN ?? process.env.DRY_RUN ?? '').toLowerCase() === 'true';

export async function sendMarketingPosts(
  dateInput: Date | string,
  options: SendMarketingOptions = {},
) {
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
    `ManySignals ${header} — ${dateLabel}`,
    content,
    '',
    SHORT_DISCLAIMER,
  ]
    .filter((line) => typeof line === 'string' && line.trim().length > 0)
    .join('\n');

  if (dryRun) {
    logInfo('marketing.send_preview', { template, dateLabel, preview: payload.slice(0, 140) });
    return { ok: true, dryRun: true, preview: payload };
  }

  await Promise.allSettled([
    promoteAll(payload),
    sendMarketingTelegram(payload),
    sendMarketingDiscord(payload),
    postToX(payload),
  ]);

  logInfo('marketing.sent', {
    template,
    dateLabel,
    signals: signals.length,
    telegram: Boolean(marketingTelegramChatId),
    discord: Boolean(marketingDiscordWebhook),
  });

  return { ok: true, posted: true, count: signals.length };
}

function sanitizeLine(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

async function sendMarketingTelegram(content: string) {
  if (!marketingTelegramChatId) return;
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!token) return;
  try {
    const bot = new TelegramBot(token, { polling: false });
    await bot.sendMessage(marketingTelegramChatId, content, {
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.warn('[marketing:telegram] error', err);
  }
}

async function sendMarketingDiscord(content: string) {
  if (!marketingDiscordWebhook) return;
  await dispatchToDiscord({ tier: 'FREE', content });
}

async function postToX(content: string) {
  if (!xAccessToken) return;
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
      console.warn('[marketing:x] failed', text.slice(0, 200));
    }
  } catch (err) {
    console.warn('[marketing:x] error', err);
  }
}
