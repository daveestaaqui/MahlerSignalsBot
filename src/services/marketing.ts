import TelegramBot from 'node-telegram-bot-api';

import type { DailyRunResult } from '../jobs/runDaily.js';
import { dispatchToDiscord } from '../posters/discord.js';
import { composePromo } from './templates.js';
import { promoteAll } from './promo.js';

const marketingTelegramChatId = process.env.MARKETING_TELEGRAM_CHAT_ID ?? '';
const marketingDiscordWebhook = process.env.MARKETING_DISCORD_WEBHOOK_URL ?? '';
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
