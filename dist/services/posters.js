import TelegramBot from 'node-telegram-bot-api';
import { request } from 'undici';
import { composePromo } from './templates.js';
import { promoteAll } from './promo.js';
import { POSTING_ENV } from '../config/posting.js';
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
const POST_ENABLED = POSTING_ENV.POST_ENABLED;
const DRY_RUN = POSTING_ENV.DRY_RUN;
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
    await bot.sendMessage(tgChats[tier], payload, {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
    });
    return true;
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
    await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return true;
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
    const { message, symbols } = unwrapPayload(input);
    const summary = {
        posted: 0,
        attempted: 2,
        errors: [],
    };
    let telegramSent = false;
    try {
        const ok = await postTelegram(tier, message);
        if (ok) {
            summary.posted += 1;
            telegramSent = true;
        }
        else {
            const error = toProviderError('telegram', 'not_configured', { tier });
            summary.errors.push(error);
            logProviderError(error);
        }
    }
    catch (err) {
        const error = toProviderError('telegram', err, { tier });
        summary.errors.push(error);
        logProviderError(error);
    }
    if (telegramSent) {
        const promoText = composePromo([{ symbols, compact: message.compact, plain: message.plain }]);
        try {
            await promoteAll(promoText);
        }
        catch (err) {
            log('warn', 'promo_dispatch_failed', {
                provider: 'promo_all',
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    try {
        const ok = await postDiscord(tier, message);
        if (ok) {
            summary.posted += 1;
        }
        else {
            const error = toProviderError('discord', 'not_configured', { tier });
            summary.errors.push(error);
            logProviderError(error);
        }
    }
    catch (err) {
        const error = toProviderError('discord', err, { tier });
        summary.errors.push(error);
        logProviderError(error);
    }
    return summary;
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
function toProviderError(provider, err, context) {
    if (typeof err === 'string') {
        return { provider, message: err, context };
    }
    if (err instanceof Error) {
        const maybeCode = err.code;
        const code = typeof maybeCode === 'string' ? maybeCode : undefined;
        return {
            provider,
            code,
            message: err.message || err.name,
            context,
        };
    }
    try {
        return { provider, message: JSON.stringify(err), context };
    }
    catch {
        return { provider, message: 'unknown-error', context };
    }
}
function logProviderError(error) {
    const { provider, code, message, context } = error;
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: 'provider_error',
        provider,
        code: code ?? null,
        message,
        context: context ?? null,
    }));
}
function unwrapPayload(input) {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            if (parsed && parsed.message) {
                return {
                    message: toMessage(parsed.message),
                    symbols: Array.isArray(parsed.symbols)
                        ? parsed.symbols.filter((symbol) => typeof symbol === 'string')
                        : [],
                };
            }
        }
        catch {
            // best-effort fall through to treat as raw string
        }
    }
    else if (input && typeof input === 'object' && 'symbols' in input) {
        const candidate = input;
        return {
            message: toMessage(candidate),
            symbols: Array.isArray(candidate.symbols)
                ? candidate.symbols.filter((symbol) => typeof symbol === 'string')
                : [],
        };
    }
    return { message: toMessage(input), symbols: [] };
}
