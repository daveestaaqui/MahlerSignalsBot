import TelegramBot from 'node-telegram-bot-api';
import { request } from 'undici';
import { withRetry } from '../lib/limits.js';
const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
const tgChats = {
    FREE: process.env.TELEGRAM_CHAT_ID_FREE || '',
    PRO: process.env.TELEGRAM_CHAT_ID_PRO || '',
    ELITE: process.env.TELEGRAM_CHAT_ID_ELITE || '',
};
const discordWebhooks = {
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
function normalizeTier(input) {
    return input.toUpperCase();
}
function toMessage(input) {
    if (typeof input === 'string') {
        const plain = stripHtml(input);
        const compact = compressWhitespace(plain);
        return { telegram: input, plain, compact };
    }
    if (!input.compact) {
        const fallback = compressWhitespace(input.plain ?? stripHtml(input.telegram));
        return { ...input, compact: fallback };
    }
    return input;
}
export async function postTelegram(tierInput, input) {
    const tier = normalizeTier(tierInput);
    if (!tgToken || !tgChats[tier])
        return false;
    const message = toMessage(input);
    const bot = new TelegramBot(tgToken, { polling: false });
    const payload = `${message.telegram}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
    if (!POST_ENABLED || DRY_RUN) {
        log('info', 'telegram_dry_run', { tier, preview: payload.slice(0, 160) });
        return true;
    }
    try {
        await withRetry(() => bot.sendMessage(tgChats[tier], payload, {
            disable_web_page_preview: true,
            parse_mode: 'HTML',
        }), 3, 400);
        return true;
    }
    catch (err) {
        log('error', 'telegram_error', { tier, error: formatError(err) });
        throw err;
    }
}
export async function postDiscord(tierInput, input) {
    const tier = normalizeTier(tierInput);
    const url = discordWebhooks[tier];
    if (!url)
        return false;
    const message = toMessage(input);
    const payload = {
        content: `${message.compact}\n\n⚠️ Not financial advice • https://aurora-signals.onrender.com`,
        username: tier === 'ELITE' ? 'Aurora Elite' : 'Aurora Signals',
    };
    if (!POST_ENABLED || DRY_RUN) {
        log('info', 'discord_dry_run', { tier, preview: payload.content.slice(0, 160) });
        return true;
    }
    try {
        await withRetry(() => request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }), 3, 400);
        return true;
    }
    catch (err) {
        log('error', 'discord_error', { tier, error: formatError(err) });
        throw err;
    }
}
export async function postX(input) {
    if (!xCreds.apiKey || !xCreds.apiSecret || !xCreds.accessToken || !xCreds.accessSecret) {
        log('warn', 'x_missing_credentials');
        return false;
    }
    const message = toMessage(input);
    const payload = `${message.compact}\n⚠️ Not financial advice • https://aurora-signals.onrender.com`;
    if (!POST_ENABLED || DRY_RUN) {
        log('info', 'x_dry_run', { preview: payload.slice(0, 200) });
        return true;
    }
    log('info', 'x_queue', { preview: payload.slice(0, 200) });
    return true;
}
export async function broadcast(tierInput, input) {
    const tier = normalizeTier(tierInput);
    const results = await Promise.allSettled([
        postTelegram(tier, input),
        postDiscord(tier, input),
    ]);
    return results.some((r) => r.status === 'fulfilled');
}
export function teaserFor(tierInput, symbols) {
    const tier = normalizeTier(tierInput);
    const emoji = tier === 'ELITE' ? '👑' : tier === 'PRO' ? '⭐' : '🆓';
    return `${emoji} ${tier} Signals: ${symbols.join(' • ')} | https://aurora-signals.onrender.com`;
}
function stripHtml(value) {
    return value.replace(/<[^>]*>/g, '');
}
function compressWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function log(level, msg, meta) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, meta }));
}
function formatError(reason) {
    if (reason instanceof Error)
        return reason.message || reason.name;
    if (typeof reason === 'string')
        return reason;
    try {
        return JSON.stringify(reason);
    }
    catch {
        return 'unknown-error';
    }
}
