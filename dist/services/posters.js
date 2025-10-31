async function postTelegram(_p) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chats = [process.env.TELEGRAM_CHAT_ID_PRO, process.env.TELEGRAM_CHAT_ID_ELITE, process.env.TELEGRAM_CHAT_ID_FREE].filter(Boolean);
    if (!token || chats.length === 0)
        return false;
    return true;
}
async function postX(_p) {
    const key = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    if (!key)
        return false;
    return true;
}
async function postDiscord(_p) {
    const hooks = [process.env.DISCORD_WEBHOOK_URL_PRO, process.env.DISCORD_WEBHOOK_URL_ELITE, process.env.DISCORD_WEBHOOK_URL_FREE].filter(Boolean);
    if (hooks.length === 0)
        return false;
    return true;
}
function normalizePayload(a, b) {
    if (typeof a === 'string' && typeof b === 'string')
        return { text: b };
    if (typeof a === 'string' && b && typeof b === 'object')
        return b;
    if (typeof a === 'string' && b === undefined)
        return { text: a };
    return a;
}
export async function broadcast(a, b) {
    const payload = normalizePayload(a, b);
    const providerErrors = [];
    let posted = 0;
    const tasks = [
        postTelegram(payload).then(ok => ['telegram', ok]),
        postX(payload).then(ok => ['x', ok]),
        postDiscord(payload).then(ok => ['discord', ok]),
    ];
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
        if (r.status === 'fulfilled') {
            const [provider, ok] = r.value;
            if (ok)
                posted += 1;
            else
                providerErrors.push({ provider, error: 'not-configured-or-rejected' });
        }
        else {
            const msg = r.reason?.message || String(r.reason || 'unknown');
            providerErrors.push({ provider: 'telegram', error: msg });
        }
    }
    return { posted, providerErrors, errors: providerErrors };
}
