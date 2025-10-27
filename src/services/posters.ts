import TelegramBot from 'node-telegram-bot-api';
import { request } from 'undici';

type Tier = 'FREE' | 'PRO' | 'ELITE';
type TierInput = Tier | Lowercase<Tier>;

const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
const tgChats: Record<Tier, string> = {
  FREE: process.env.TELEGRAM_CHAT_ID_FREE || '',
  PRO: process.env.TELEGRAM_CHAT_ID_PRO || '',
  ELITE: process.env.TELEGRAM_CHAT_ID_ELITE || '',
};

const discordWebhooks: Record<Tier, string> = {
  FREE: process.env.DISCORD_WEBHOOK_URL_FREE || '',
  PRO: process.env.DISCORD_WEBHOOK_URL_PRO || '',
  ELITE: process.env.DISCORD_WEBHOOK_URL_ELITE || '',
};

const POST_ENABLED = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
const DRY_RUN = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';

const xCreds = {
  apiKey: process.env.X_API_KEY,
  apiSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
};

function normalizeTier(input: TierInput): Tier {
  return input.toUpperCase() as Tier;
}

export async function postTelegram(tierInput: TierInput, text: string) {
  const tier = normalizeTier(tierInput);
  if (!tgToken || !tgChats[tier]) return false;
  const bot = new TelegramBot(tgToken, { polling: false });
  const payload = `${text}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  if (!POST_ENABLED || DRY_RUN) {
    log('info', 'telegram_dry_run', { tier, preview: text.slice(0, 120) });
    return true;
  }
  await bot.sendMessage(tgChats[tier], payload, {
    disable_web_page_preview: true,
    parse_mode: 'HTML',
  });
  return true;
}

export async function postDiscord(tierInput: TierInput, text: string) {
  const tier = normalizeTier(tierInput);
  const url = discordWebhooks[tier];
  if (!url) return false;
  const payload = {
    content: `${text}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`,
    username: tier === 'ELITE' ? 'Aurora Elite' : 'Aurora Signals',
  };
  if (!POST_ENABLED || DRY_RUN) {
    log('info', 'discord_dry_run', { tier, preview: text.slice(0, 120) });
    return true;
  }
  await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return true;
}

export async function postX(text: string) {
  if (!xCreds.apiKey || !xCreds.apiSecret || !xCreds.accessToken || !xCreds.accessSecret) {
    log('warn', 'x_missing_credentials');
    return false;
  }
  const payload = `${text}\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
  if (!POST_ENABLED || DRY_RUN) {
    log('info', 'x_dry_run', { preview: payload.slice(0, 200) });
    return true;
  }
  log('info', 'x_queue', { preview: payload.slice(0, 200) });
  return true;
}

export async function broadcast(tierInput: TierInput, text: string) {
  const tier = normalizeTier(tierInput);
  const results = await Promise.allSettled([
    postTelegram(tier, text),
    postDiscord(tier, text),
  ]);
  return results.some(r => r.status === 'fulfilled');
}

export function teaserFor(tierInput: TierInput, symbols: string[]): string {
  const tier = normalizeTier(tierInput);
  const emoji = tier === 'ELITE' ? '👑' : tier === 'PRO' ? '⭐' : '🆓';
  return `${emoji} ${tier} Signals: ${symbols.join(' • ')} | https://aurora-signals.onrender.com`;
}

function log(level:'info'|'warn'|'error', msg:string, meta?:Record<string, unknown>){
  console.log(JSON.stringify({ ts:new Date().toISOString(), level, msg, meta }));
}
