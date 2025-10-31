import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch.js';
import { buildWeeklyDigest } from '../services/weeklyDigest.js';
import { getLedgerCounts } from '../lib/publishLedger.js';
import { CADENCE, todayIso } from '../config/cadence.js';
import { POSTING_RULES } from '../config/posting.js';
import { postTelegram } from '../services/posters.js';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const APP_VERSION = readVersion();
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
    run: await runDailyOnce(),
})), c);
const postNowHandler = (c) => withLock('manual-run', 'admin/post-now', () => {
    const assets = assetsWithRemainingCapacity();
    const options = assets.length ? { assets } : {};
    return executeAdminRun(c, 'admin/post-now', async () => ({
        run: await runDailyOnce(options),
        context: { assetsRequested: assets },
    }));
}, c);
const postWeeklyHandler = async (c) => {
    const flags = resolveFlags();
    const route = 'admin/post-weekly';
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
const previewDailyHandler = async (c) => {
    const flags = resolveFlags();
    try {
        const run = await runDailyOnce({ preview: true });
        const flush = createEmptyFlush();
        const reason = determineReason(run, flush);
        return sendDailyResponse(c, {
            route: 'preview/daily',
            run,
            flush,
            flags,
            reason,
            extra: { preview: true },
        });
    }
    catch (err) {
        return sendDailyError(c, 'preview/daily', flags, err);
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
                const ok = await postTelegram(tier, 'AuroraSignalX sanity');
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
app.get('/', (c) => c.json({ ok: true, version: APP_VERSION }));
aliasRoutes(app, 'GET', '/status', statusHandler);
aliasRoutes(app, 'GET', '/diagnostics', diagnosticsHandler);
aliasRoutes(app, 'GET', '/weekly-summary', weeklySummaryHandler);
aliasRoutes(app, 'GET', '/preview/daily', adminAuth, previewDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-now', adminAuth, postNowHandler);
aliasRoutes(app, 'POST', '/admin/post-daily', adminAuth, postDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-weekly', adminAuth, postWeeklyHandler);
aliasRoutes(app, 'POST', '/admin/test-telegram', adminAuth, testTelegramHandler);
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
    const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
    const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
    return {
        dryRun,
        postEnabled,
        limits: {
            dailyPostCap: POSTING_RULES.DAILY_POST_CAP,
            maxPostsPerDay: CADENCE.MAX_POSTS_PER_DAY,
            minScorePro: POSTING_RULES.MIN_SCORE_PRO,
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
