import TelegramBot from 'node-telegram-bot-api';

import type { FormattedMessage } from './formatters.js';
import { POSTING_ENV } from '../config/posting.js';
import { postToDiscord as dispatchToDiscord } from './posters/discord.js';

export type Tier = 'FREE' | 'PRO' | 'ELITE';
export type Provider = 'telegram' | 'discord';

export type ProviderError = {
  provider: Provider;
  message: string;
  context?: Record<string, unknown>;
};

export type ProviderOutcome = {
  posted: boolean;
  skippedReason?: string;
  error?: string;
};

export type BroadcastSummary = {
  posted: number;
  providerErrors: ProviderError[];
};

type TierInput = Tier | Lowercase<Tier>;
type MessageInput = string | FormattedMessage;

const tgToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const telegramChats: Record<Tier, string> = {
  FREE: process.env.TELEGRAM_CHAT_ID_FREE ?? '',
  PRO: process.env.TELEGRAM_CHAT_ID_PRO ?? '',
  ELITE: process.env.TELEGRAM_CHAT_ID_ELITE ?? '',
};

const POST_ENABLED = POSTING_ENV.POST_ENABLED;
const DRY_RUN = POSTING_ENV.DRY_RUN;

export function normalizeTier(input: TierInput): Tier {
  const upper = String(input ?? '').toUpperCase() as Tier;
  if (upper === 'FREE' || upper === 'PRO' || upper === 'ELITE') {
    return upper;
  }
  return 'FREE';
}

export async function postTelegram(tierInput: TierInput, input: MessageInput): Promise<ProviderOutcome> {
  const tier = normalizeTier(tierInput);
  const chatId = telegramChats[tier];
  if (!tgToken || !chatId) {
    log('warn', 'telegram_skip_missing_config', { tier });
    return { posted: false, skippedReason: 'missing_config' };
  }

  const message = toMessage(input);
  const payload = `${message.telegram}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  if (!POST_ENABLED) {
    log('info', 'telegram_skip_post_disabled', { tier, preview: payload.slice(0, 160) });
    return { posted: false, skippedReason: 'post_disabled' };
  }
  if (DRY_RUN) {
    log('info', 'telegram_skip_dry_run', { tier, preview: payload.slice(0, 160) });
    return { posted: false, skippedReason: 'dry_run' };
  }

  try {
    const bot = new TelegramBot(tgToken, { polling: false });
    await bot.sendMessage(chatId, payload, {
      disable_web_page_preview: true,
      parse_mode: 'HTML',
    });
    log('info', 'telegram_post_success', { tier });
    return { posted: true };
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    log('error', 'telegram_post_failed', { tier, error: messageText });
    return { posted: false, error: messageText };
  }
}

export async function postDiscord(tierInput: TierInput, input: MessageInput): Promise<ProviderOutcome> {
  const tier = normalizeTier(tierInput);
  const message = toMessage(input);
  const content = `${message.compact}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  const result = await dispatchToDiscord({ tier, content });
  if (result.sent) {
    return { posted: true };
  }
  if (result.error) {
    return { posted: false, error: result.error };
  }
  return { posted: false, skippedReason: result.skippedReason ?? 'skipped' };
}

export async function broadcast(tierInput: TierInput, input: MessageInput): Promise<BroadcastSummary> {
  const tier = normalizeTier(tierInput);
  const summary: BroadcastSummary = {
    posted: 0,
    providerErrors: [],
  };

  const providers: Array<{ name: Provider; send: () => Promise<ProviderOutcome> }> = [
    { name: 'telegram', send: () => postTelegram(tier, input) },
    { name: 'discord', send: () => postDiscord(tier, input) },
  ];

  for (const provider of providers) {
    try {
      const outcome = await provider.send();
      if (outcome.posted) {
        summary.posted += 1;
        continue;
      }
      if (outcome.error) {
        summary.providerErrors.push({
          provider: provider.name,
          message: outcome.error,
          context: { tier },
        });
      }
    } catch (err) {
      summary.providerErrors.push({
        provider: provider.name,
        message: err instanceof Error ? err.message : String(err),
        context: { tier },
      });
    }
  }

  return summary;
}

function toMessage(input: MessageInput): FormattedMessage {
  if (typeof input === 'string') {
    return {
      telegram: input,
      plain: stripHtml(input),
      compact: compressWhitespace(stripHtml(input)),
    };
  }
  const compact = input.compact ?? compressWhitespace(input.plain ?? stripHtml(input.telegram));
  const plain = input.plain ?? stripHtml(input.telegram);
  return { ...input, compact, plain };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function log(level: 'info' | 'warn' | 'error', event: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, meta }));
}
