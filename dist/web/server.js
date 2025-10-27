import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { generateWeeklySummary } from '../services/weeklySummary.js';
import { POSTING_RULES } from '../config/posting.js';
import { broadcast } from '../services/posters.js';
const app = new Hono();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
app.get('/', c => c.json({ ok: true }));
app.get('/status', c => c.json({
    ok: true,
    ts: Date.now() / 1000,
    env: {
        postEnabled: (process.env.POST_ENABLED || 'true').toLowerCase() === 'true',
        dryRun: (process.env.DRY_RUN || 'false').toLowerCase() === 'true',
    },
    postingRules: {
        dailyPostCap: POSTING_RULES.DAILY_POST_CAP,
        minScorePro: POSTING_RULES.MIN_SCORE_PRO,
        minScoreElite: POSTING_RULES.MIN_SCORE_ELITE,
        cooldownDays: Math.round(POSTING_RULES.COOLDOWN_SECONDS / (24 * 3600)),
        flowUsdMin: POSTING_RULES.FLOW_USD_MIN,
    },
}));
app.get('/diagnostics', c => c.json({
    ok: true,
    ts: Date.now() / 1000,
    environment: {
        baseUrl: process.env.BASE_URL || null,
        postEnabled: (process.env.POST_ENABLED || 'true').toLowerCase() === 'true',
        dryRun: (process.env.DRY_RUN || 'false').toLowerCase() === 'true',
        alphavantage: Boolean(process.env.ALPHAVANTAGE_KEY),
        finnhub: Boolean(process.env.FINNHUB_KEY),
        polygon: Boolean(process.env.POLYGON_KEY),
        whaleAlert: Boolean(process.env.WHALE_ALERT_KEY),
        telegram: {
            token: Boolean(process.env.TELEGRAM_BOT_TOKEN),
            free: Boolean(process.env.TELEGRAM_CHAT_ID_FREE),
            pro: Boolean(process.env.TELEGRAM_CHAT_ID_PRO),
            elite: Boolean(process.env.TELEGRAM_CHAT_ID_ELITE),
        },
    },
    postingRules: POSTING_RULES,
}));
app.get('/weekly-summary', c => {
    const summary = generateWeeklySummary();
    return c.json({ ok: true, summary });
});
app.post('/admin/post-daily', async (c) => {
    if (!isAuthorized(c.req.raw))
        return c.json({ ok: false, error: 'unauthorized' }, 401);
    const lockName = 'daily-run';
    if (!acquireLock(lockName, 600))
        return c.json({ ok: false, error: 'locked' }, 409);
    try {
        const result = await runDailyOnce();
        await flushPublishQueue();
        return c.json({ ok: true, result });
    }
    catch (err) {
        console.error('[admin/post-daily]', err);
        return c.json({ ok: false, error: 'internal_error' }, 500);
    }
    finally {
        releaseLock(lockName);
    }
});
app.post('/admin/post-weekly', async (c) => {
    if (!isAuthorized(c.req.raw))
        return c.json({ ok: false, error: 'unauthorized' }, 401);
    const summary = generateWeeklySummary();
    try {
        const message = formatWeeklyDigest(summary);
        const deliveries = await Promise.allSettled([
            broadcast('PRO', message),
            broadcast('ELITE', message),
        ]);
        const delivered = deliveries.map((result, idx) => ({
            tier: idx === 0 ? 'PRO' : 'ELITE',
            status: result.status,
        }));
        return c.json({ ok: true, summary, delivered, preview: message });
    }
    catch (err) {
        console.error('[admin/post-weekly]', err);
        return c.json({ ok: false, error: 'internal_error' }, 500);
    }
});
const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, () => {
    console.log(`HTTP server listening on :${port}`);
});
export default app;
function isAuthorized(req) {
    if (!ADMIN_TOKEN)
        return false;
    const header = req.headers.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    return token === ADMIN_TOKEN;
}
function formatWeeklyDigest(summary) {
    const header = `📊 Weekly KPIs • ${summary.generatedAt.slice(0, 10)}`;
    const hitRate = (summary.hitRate5D * 100).toFixed(0);
    const countsLine = Object.entries(summary.countsByTier)
        .map(([tier, count]) => `${tier.toUpperCase()}: ${count}`)
        .join(' | ') || 'No sends logged';
    const winnersLine = summary.topWinners.length
        ? summary.topWinners.join(' • ')
        : 'No standout winners yet';
    const losersLine = summary.topLosers.length
        ? summary.topLosers.join(' • ')
        : 'No notable losers logged';
    const body = [
        `Signals: ${summary.totalSignals} • Hit rate: ${hitRate}%`,
        `Avg score: ${summary.averageScore}`,
        `Tier mix: ${countsLine}`,
        `Avg/Med P&L: ${(summary.averagePnl * 100).toFixed(1)}% / ${(summary.medianPnl * 100).toFixed(1)}%`,
        `Top winners: ${winnersLine}`,
        `Top losers: ${losersLine}`,
    ];
    return [header, ...body].join('\n');
}
