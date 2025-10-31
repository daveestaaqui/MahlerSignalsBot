import TelegramBot from 'node-telegram-bot-api';

import type { FormattedMessage } from './formatters.js';
import { POSTING_ENV } from '../config/posting.js';
import { postToDiscord } from '../posters/discord.js';

export type Tier = 'FREE' | 'PRO' | 'ELITE';
export type Provider = 'telegram' | 'discord';

export type ProviderError = {
  provider: Provider;
  message: string;
  context?: Record<string, unknown>;
};

export type ProviderOutcome = {
  ok: boolean;
  provider: Provider;
  delivered: boolean;
  skipped?: string;
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
  const message = toMessage(input);
  const payload = `${message.telegram}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  const logMeta = { tier, preview: payload.slice(0, 160) };

  if (!tgToken || !chatId) {
    log('warn', 'telegram_skip_missing_config', logMeta);
    return { ok: false, provider: 'telegram', delivered: false, skipped: 'missing_config' };
  }
  if (!POST_ENABLED) {
    log('info', 'telegram_skip_post_disabled', logMeta);
    return { ok: true, provider: 'telegram', delivered: false, skipped: 'post_disabled' };
  }
  if (DRY_RUN) {
    log('info', 'telegram_skip_dry_run', logMeta);
    return { ok: true, provider: 'telegram', delivered: false, skipped: 'dry_run' };
  }

  try {
    const bot = new TelegramBot(tgToken, { polling: false });
    await bot.sendMessage(chatId, payload, {
      disable_web_page_preview: true,
      parse_mode: 'HTML',
    });
    log('info', 'telegram_post_success', { tier });
    return { ok: true, provider: 'telegram', delivered: true };
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    log('error', 'telegram_post_failed', { tier, error: messageText });
    return { ok: false, provider: 'telegram', delivered: false, error: messageText };
  }
}

export async function postDiscord(tierInput: TierInput, input: MessageInput): Promise<ProviderOutcome> {
  const tier = normalizeTier(tierInput);
  const message = toMessage(input);
  const content = `${message.compact}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  const result = await postToDiscord({ tier, content });
  if (result.delivered) {
    return { ok: true, provider: 'discord', delivered: true };
  }
  if (result.error) {
    return { ok: false, provider: 'discord', delivered: false, error: result.error };
  }
  return { ok: true, provider: 'discord', delivered: false, skipped: result.skipped };
}

export async function broadcast(tierInput: TierInput, input: MessageInput): Promise<BroadcastSummary> {
  const tier = normalizeTier(tierInput);
  const summary: BroadcastSummary = { posted: 0, providerErrors: [] };

  const providers: Array<() => Promise<ProviderOutcome>> = [
    () => postTelegram(tier, input),
    () => postDiscord(tier, input),
  ];

  for (const send of providers) {
    try {
      const outcome = await send();
      if (outcome.delivered) {
        summary.posted += 1;
      } else if (outcome.error) {
        summary.providerErrors.push({
          provider: outcome.provider,
          message: outcome.error,
          context: { tier, skipped: outcome.skipped },
        });
      }
    } catch (err) {
      summary.providerErrors.push({
        provider: 'telegram',
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
