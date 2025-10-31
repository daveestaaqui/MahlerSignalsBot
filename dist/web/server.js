import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch.js';
import { buildWeeklyDigest } from '../services/weeklyDigest.js';
import { getLedgerCounts } from '../lib/publishLedger.js';
import { CADENCE, todayIso } from '../config/cadence.js';
import { POSTING_RULES, POSTING_ENV } from '../config/posting.js';
import { postTelegram } from '../services/posters.js';
import { postToX, postToDiscord } from '../services/promo.js';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TEST_MESSAGE = 'AuroraSignals test OK';
const APP_VERSION = readVersion();
let runDaily = runDailyOnce;
export function setRunDailyRunner(fn) {
    runDaily = fn;
}
export function resetRunDailyRunner() {
    runDaily = runDailyOnce;
}
const app = new Hono();
export { app };
export default app;
function aliasRoutes(router, method, path, ...handlers) {
    router.on(method, path, ...handlers);
    router.on(method, `/api${path}`, ...handlers);
}
const statusHandler = (c) => {
    try {
        const flags = resolveFlags();
        return c.json({
            ok: true,
            version: APP_VERSION,
            time: new Date().toISOString(),
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            limits: flags.limits,
            cadence: {
                maxPostsPerDay: CADENCE.MAX_POSTS_PER_DAY,
                enableStocks: CADENCE.ENABLE_STOCKS_DAILY,
                enableCrypto: CADENCE.ENABLE_CRYPTO_DAILY,
                timezone: CADENCE.TIMEZONE,
            },
        });
    }
    catch (err) {
        console.error('[status]', err);
        return c.json(degradedPayload(err), 200);
    }
};
const diagnosticsHandler = (c) => {
    try {
        const env = resolveFlags();
        const today = todayIso();
        const ledger = getLedgerCounts(today);
        return c.json({
            ok: true,
            env: {
                POST_ENABLED: env.postEnabled,
                DRY_RUN: env.dryRun,
                NODE_ENV: process.env.NODE_ENV ?? 'development',
                limits: env.limits,
            },
            cadence: {
                date: today,
                ledger,
                maxPostsPerDay: CADENCE.MAX_POSTS_PER_DAY,
                timezone: CADENCE.TIMEZONE,
                cryptoMajors: CADENCE.CRYPTO_MAJOR_SYMBOLS,
            },
        });
    }
    catch (err) {
        console.error('[diagnostics]', err);
        return c.json(degradedPayload(err, { env: resolveFlags(), cadence: null }), 200);
    }
};
const weeklySummaryHandler = (c) => {
    try {
        const digest = buildWeeklyDigest();
        return c.json({
            ok: true,
            summary: digest.summary,
            message: digest.message,
        });
    }
    catch (err) {
        console.error('[weekly-summary]', err);
        return c.json(degradedPayload(err, {
            summary: null,
        }), 200);
    }
};
const adminAuth = async (c, next) => {
    if (!isAuthorized(c.req.raw)) {
        return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    await next();
};
const postDailyHandler = (c) => withLock('daily-run', 'admin/post-daily', () => executeAdminRun(c, 'admin/post-daily', async () => ({
    run: await runDaily(),
})), c);
const postNowHandler = async (c) => {
    const force = await resolveForceParam(c);
    const minScoreOverride = parseOptionalNumber(c.req.query('minScore'));
    const assets = assetsWithRemainingCapacity();
    const options = {};
    if (assets.length) {
        options.assets = assets;
    }
    if (minScoreOverride !== undefined) {
        options.minScore = minScoreOverride;
    }
    const runner = () => executeAdminRun(c, 'admin/post-now', async () => ({
        run: await runDaily(options),
        context: {
            assetsRequested: assets,
            minScoreOverride: minScoreOverride ?? null,
            force,
        },
    }));
    if (force) {
        return runner();
    }
    return withLock('manual-run', 'admin/post-now', runner, c);
};
const postWeeklyHandler = async (c) => {
    const force = await resolveForceParam(c);
    const route = 'admin/post-weekly';
    const runner = async () => {
        const flags = resolveFlags();
        logAdminEvent(route, 'start', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
        });
        try {
            const result = await dispatchWeeklyDigest({
                dryRun: flags.dryRun,
                postEnabled: flags.postEnabled,
            });
            const selected = result.digest.summary.count;
            const providerErrors = result.providerErrors;
            const posted = result.posted;
            const reason = determineWeeklyReason(flags, selected, posted, providerErrors);
            logAdminEvent(route, 'end', {
                dryRun: flags.dryRun,
                postEnabled: flags.postEnabled,
                capacityBefore: null,
                selectedCount: selected,
                postedCount: posted,
                providerErrorsCount: providerErrors.length,
                reason,
            });
            return c.json({
                ok: true,
                route,
                dryRun: flags.dryRun,
                postEnabled: flags.postEnabled,
                posted,
                selected,
                reason,
                errors: providerErrors,
                summary: result.digest.summary,
                degraded: providerErrors.length > 0,
            }, 200);
        }
        catch (err) {
            logAdminEvent(route, 'error', {
                dryRun: flags.dryRun,
                postEnabled: flags.postEnabled,
                capacityBefore: null,
                selectedCount: 0,
                postedCount: 0,
                providerErrorsCount: 0,
                error: formatReason(err),
            });
            return sendDailyError(c, route, flags, err);
        }
    };
    if (force) {
        return runner();
    }
    return withLock('weekly-run', route, runner, c);
};
const previewDailyHandler = async (c) => {
    const flags = resolveFlags();
    const rawLimit = parseOptionalNumber(c.req.query('limit'));
    const limit = rawLimit === undefined ? 10 : Math.max(0, Math.floor(rawLimit));
    const rawMinScore = parseOptionalNumber(c.req.query('minScore'));
    const minScore = rawMinScore ?? POSTING_ENV.MIN_SCORE_PRO;
    try {
        const run = await runDaily({ preview: true, limit, minScore });
        const flush = createEmptyFlush();
        const reason = determineReason(run, flush);
        return sendDailyResponse(c, {
            route: 'preview/daily',
            run,
            flush,
            flags,
            reason,
            extra: { preview: true, limit, minScore },
        });
    }
    catch (err) {
        return sendDailyError(c, 'preview/daily', flags, err, {
            extra: { limit, minScore, preview: true },
        });
    }
};
const testTelegramHandler = async (c) => {
    const flags = resolveFlags();
    const route = 'admin/test-telegram';
    logAdminEvent(route, 'start', {
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        capacityBefore: null,
        selectedCount: 0,
        postedCount: 0,
        providerErrorsCount: 0,
    });
    try {
        const tiers = ['PRO', 'ELITE'];
        const errors = [];
        let sent = 0;
        for (const tier of tiers) {
            try {
                const ok = await postTelegram(tier, TEST_MESSAGE);
                if (ok) {
                    sent += 1;
                }
                else {
                    errors.push({ provider: `telegram:${tier.toLowerCase()}`, message: 'not_configured' });
                }
            }
            catch (err) {
                errors.push({ provider: `telegram:${tier.toLowerCase()}`, message: formatReason(err) });
            }
        }
        const reason = errors.length ? (sent > 0 ? 'partial_failure' : 'failed_dispatch') : 'dispatched';
        logAdminEvent(route, 'end', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: tiers.length,
            postedCount: sent,
            providerErrorsCount: errors.length,
            reason,
        });
        return c.json({
            ok: true,
            route,
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            attempted: tiers.length,
            sent,
            reason,
            errors,
        }, 200);
    }
    catch (err) {
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
        });
        return sendDailyError(c, route, flags, err);
    }
};
const testXHandler = async (c) => {
    const flags = resolveFlags();
    const route = 'admin/test-x';
    logAdminEvent(route, 'start', {
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        capacityBefore: null,
        selectedCount: 0,
        postedCount: 0,
        providerErrorsCount: 0,
    });
    try {
        const result = await postToX(TEST_MESSAGE);
        const reason = result.ok ? 'dispatched' : 'failed_dispatch';
        logAdminEvent(route, 'end', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 1,
            postedCount: result.ok ? 1 : 0,
            providerErrorsCount: result.ok ? 0 : 1,
            reason,
        });
        return c.json({
            ok: result.ok,
            route,
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            id: result.id ?? null,
            error: result.ok ? null : result.error ?? 'x_post_failed',
        }, 200);
    }
    catch (err) {
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
        });
        return c.json({
            ok: false,
            route,
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            error: formatReason(err),
        }, 200);
    }
};
const testDiscordHandler = async (c) => {
    const flags = resolveFlags();
    const route = 'admin/test-discord';
    logAdminEvent(route, 'start', {
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        capacityBefore: null,
        selectedCount: 0,
        postedCount: 0,
        providerErrorsCount: 0,
    });
    try {
        const result = await postToDiscord(TEST_MESSAGE);
        const reason = result.ok ? 'dispatched' : 'failed_dispatch';
        logAdminEvent(route, 'end', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 1,
            postedCount: result.ok ? 1 : 0,
            providerErrorsCount: result.ok ? 0 : 1,
            reason,
        });
        return c.json({
            ok: result.ok,
            route,
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            error: result.ok ? null : result.error ?? 'discord_post_failed',
        }, 200);
    }
    catch (err) {
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
        });
        return c.json({
            ok: false,
            route,
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            error: formatReason(err),
        }, 200);
    }
};
const unlockHandler = async (c) => {
    const force = await resolveForceParam(c);
    const locks = ['manual-run', 'daily-run', 'weekly-run'];
    for (const name of locks) {
        releaseLock(name);
    }
    return c.json({
        ok: true,
        cleared: locks,
        force,
    }, 200);
};
const healthProvidersHandler = (c) => {
    const dryRun = POSTING_ENV.DRY_RUN;
    const promoEnabled = POSTING_ENV.PROMO_ENABLED;
    return c.json({
        ok: true,
        dryRun,
        promo: {
            telegram: telegramConfigured(),
            x: promoEnabled && POSTING_ENV.PROMO_X_ENABLED && Boolean(POSTING_ENV.X_BEARER_TOKEN),
            discord: promoEnabled && POSTING_ENV.PROMO_DISCORD_ENABLED && Boolean(POSTING_ENV.DISCORD_WEBHOOK_URL),
        },
    }, 200);
};
app.get('/', (c) => c.json({ ok: true, version: APP_VERSION }));
aliasRoutes(app, 'GET', '/status', statusHandler);
aliasRoutes(app, 'GET', '/diagnostics', diagnosticsHandler);
aliasRoutes(app, 'GET', '/weekly-summary', weeklySummaryHandler);
aliasRoutes(app, 'GET', '/preview/daily', adminAuth, previewDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-now', adminAuth, postNowHandler);
aliasRoutes(app, 'POST', '/admin/post-daily', adminAuth, postDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-weekly', adminAuth, postWeeklyHandler);
aliasRoutes(app, 'POST', '/admin/test-telegram', adminAuth, testTelegramHandler);
aliasRoutes(app, 'POST', '/admin/test-x', adminAuth, testXHandler);
aliasRoutes(app, 'POST', '/admin/test-discord', adminAuth, testDiscordHandler);
aliasRoutes(app, 'POST', '/admin/unlock', adminAuth, unlockHandler);
aliasRoutes(app, 'GET', '/health/providers', healthProvidersHandler);
function createEmptyFlush() {
    return { attempted: 0, successes: 0, posted: 0, providerErrors: [] };
}
async function executeAdminRun(c, route, runner) {
    const flags = resolveFlags();
    let outcome;
    try {
        outcome = await runner();
    }
    catch (err) {
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
        });
        return sendDailyError(c, route, flags, err);
    }
    const { run, context = {} } = outcome;
    const contextLog = Object.keys(context).length ? { context } : {};
    logAdminEvent(route, 'start', {
        dryRun: run.dryRun,
        postEnabled: run.postEnabled,
        capacityBefore: run.capacityBefore,
        selectedCount: run.selected.length,
        postedCount: 0,
        providerErrorsCount: 0,
        ...contextLog,
    });
    let flush;
    try {
        flush = await maybeFlush(run);
    }
    catch (err) {
        logAdminEvent(route, 'error', {
            dryRun: run.dryRun,
            postEnabled: run.postEnabled,
            capacityBefore: run.capacityBefore,
            selectedCount: run.selected.length,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
            ...contextLog,
        });
        return sendDailyError(c, route, flags, err, {
            extra: {
                capacityBefore: run.capacityBefore,
                selectedCount: run.selected.length,
                context,
            },
        });
    }
    const reason = determineReason(run, flush);
    logAdminEvent(route, 'end', {
        dryRun: run.dryRun,
        postEnabled: run.postEnabled,
        capacityBefore: run.capacityBefore,
        selectedCount: run.selected.length,
        postedCount: flush.posted,
        providerErrorsCount: flush.providerErrors.length,
        reason,
        ...contextLog,
    });
    return sendDailyResponse(c, {
        route,
        run,
        flush,
        flags,
        reason,
        extra: context,
    });
}
function resolveFlags() {
    return {
        dryRun: POSTING_ENV.DRY_RUN,
        postEnabled: POSTING_ENV.POST_ENABLED,
        limits: {
            dailyPostCap: POSTING_ENV.DAILY_POST_CAP,
            maxPostsPerDay: POSTING_ENV.MAX_POSTS_PER_DAY,
            minScorePro: POSTING_ENV.MIN_SCORE_PRO,
        },
    };
}
function isAuthorized(req) {
    if (!ADMIN_TOKEN)
        return false;
    const header = req.headers.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    return token === ADMIN_TOKEN;
}
async function resolveForceParam(c) {
    const queryValue = c.req.query('force');
    if (queryValue !== undefined) {
        return parseBoolean(queryValue);
    }
    try {
        const body = await c.req.json();
        if (body && typeof body === 'object' && body !== null && 'force' in body) {
            return parseBoolean(body.force);
        }
    }
    catch {
        // ignore parse errors or empty bodies
    }
    return false;
}
function parseOptionalNumber(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}
function parseBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
}
async function withLock(name, route, fn, c) {
    if (!acquireLock(name, 600)) {
        const flags = resolveFlags();
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            reason: 'locked',
        });
        return sendDailyError(c, route, flags, new Error('locked'), {
            reason: 'locked',
            errors: [{ provider: 'internal', message: 'locked', retryInSec: 30 }],
        });
    }
    try {
        return await fn();
    }
    catch (err) {
        const flags = resolveFlags();
        logAdminEvent(route, 'error', {
            dryRun: flags.dryRun,
            postEnabled: flags.postEnabled,
            capacityBefore: null,
            selectedCount: 0,
            postedCount: 0,
            providerErrorsCount: 0,
            error: formatReason(err),
        });
        return sendDailyError(c, route, flags, err);
    }
    finally {
        releaseLock(name);
    }
}
function assetsWithRemainingCapacity() {
    try {
        const ledger = getLedgerCounts();
        const totalLimit = Math.min(POSTING_RULES.DAILY_POST_CAP, CADENCE.MAX_POSTS_PER_DAY);
        const totalRemaining = Math.max(totalLimit - (ledger.stock + ledger.crypto), 0);
        if (totalRemaining <= 0) {
            return [];
        }
        const assets = [];
        if (CADENCE.ENABLE_STOCKS_DAILY && ledger.stock < totalLimit) {
            assets.push('stock');
        }
        if (CADENCE.ENABLE_CRYPTO_DAILY && ledger.crypto < totalLimit) {
            assets.push('crypto');
        }
        return assets;
    }
    catch (err) {
        console.warn('[assetsWithRemainingCapacity] fallback', formatReason(err));
        const fallback = [];
        if (CADENCE.ENABLE_STOCKS_DAILY)
            fallback.push('stock');
        if (CADENCE.ENABLE_CRYPTO_DAILY)
            fallback.push('crypto');
        return fallback;
    }
}
async function maybeFlush(result) {
    if (!result.postEnabled || result.dryRun || result.preview)
        return createEmptyFlush();
    if (!result.messages.length)
        return createEmptyFlush();
    return flushPublishQueue();
}
function determineReason(run, flush) {
    if (run.capacityBefore.total <= 0)
        return 'no_capacity';
    if (run.preview)
        return 'preview_only';
    if (!run.postEnabled || run.dryRun)
        return 'dry_run';
    if (!run.selected.length)
        return 'no_selection';
    if (flush.providerErrors.length) {
        return flush.posted > 0 ? 'partial_failure' : 'failed_dispatch';
    }
    if (flush.posted > 0)
        return 'dispatched';
    if (run.messages.length > 0)
        return 'queued';
    return 'no_dispatch';
}
function determineWeeklyReason(flags, selected, posted, errors) {
    if (!selected)
        return 'no_selection';
    if (!flags.postEnabled || flags.dryRun)
        return 'dry_run';
    if (errors.length)
        return posted > 0 ? 'partial_failure' : 'failed_dispatch';
    if (posted > 0)
        return 'dispatched';
    return 'queued';
}
function sendDailyResponse(c, args) {
    const { route, run, flush, flags, reason = determineReason(run, flush), extra = {} } = args;
    const errors = flush.providerErrors ?? [];
    const payload = {
        ok: true,
        route,
        reason,
        posted: flush.posted,
        queued: flush.successes,
        selected: run.selected.length,
        count: run.selected.length,
        skipped: Math.max(run.selected.length - flush.posted, 0),
        dryRun: run.dryRun,
        postEnabled: run.postEnabled,
        preview: run.preview,
        degraded: reason === 'internal_error' || errors.length > 0,
        errors,
        capacity: run.capacity,
        capacityBefore: run.capacityBefore,
        cadence: run.cadence,
        selection: {
            candidates: run.candidates,
            rejected: run.rejected.length,
        },
        messages: run.messages,
        generatedAt: run.generatedAt,
        selectionMeta: run.selectionMeta,
        dryRunEnv: flags.dryRun,
        postEnabledEnv: flags.postEnabled,
        limits: flags.limits,
    };
    if (Object.keys(extra).length) {
        payload.context = extra;
    }
    return c.json(payload, 200);
}
function sendDailyError(c, route, flags, err, overrides = {}) {
    const reason = overrides.reason ?? 'internal_error';
    const errors = overrides.errors ??
        [
            {
                provider: 'internal',
                message: formatReason(err),
                retryInSec: 60,
            },
        ];
    const payload = {
        ok: true,
        route,
        posted: 0,
        reason,
        errors,
        degraded: true,
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        limits: flags.limits,
    };
    if (overrides.extra && Object.keys(overrides.extra).length) {
        payload.context = overrides.extra;
    }
    return c.json(payload, 200);
}
function logAdminEvent(route, phase, data) {
    const payload = {
        ts: new Date().toISOString(),
        event: 'admin_post',
        route,
        phase,
        ...data,
    };
    console.log(JSON.stringify(payload));
}
function degradedPayload(reason, extra = {}) {
    return {
        ok: true,
        degraded: true,
        reason: formatReason(reason),
        ...extra,
    };
}
function formatReason(reason) {
    if (reason instanceof Error) {
        return reason.message || reason.name || 'unknown-error';
    }
    if (typeof reason === 'string')
        return reason;
    try {
        return JSON.stringify(reason);
    }
    catch {
        return 'unknown-error';
    }
}
function readVersion() {
    try {
        const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
        return pkg.version ?? '0.0.0';
    }
    catch (err) {
        console.error('[status] failed to read version', err);
        return '0.0.0';
    }
}
function telegramConfigured() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token)
        return false;
    const chats = [
        process.env.TELEGRAM_CHAT_ID_PRO,
        process.env.TELEGRAM_CHAT_ID_ELITE,
        process.env.TELEGRAM_CHAT_ID_FREE,
    ];
    return chats.some((value) => typeof value === 'string' && value.length > 0);
}
