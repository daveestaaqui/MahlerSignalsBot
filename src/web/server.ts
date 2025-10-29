import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { Handler, MiddlewareHandler } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { generateWeeklySummary } from '../services/weeklySummary.js';
import { broadcast } from '../services/posters.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const APP_VERSION = readVersion();

const app = new Hono();

export { app };
export default app;

type Method = 'GET' | 'POST';
type RouteHandler = Handler | MiddlewareHandler;

function aliasRoutes(router: Hono, method: Method, path: string, ...handlers: RouteHandler[]) {
  router.on(method, path, ...(handlers as Handler[]));
  router.on(method, `/api${path}`, ...(handlers as Handler[]));
}

const statusHandler: Handler = (c) =>
  c.json({
    ok: true,
    version: APP_VERSION,
    time: new Date().toISOString(),
  });

const diagnosticsHandler: Handler = (c) => {
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  return c.json({
    ok: true,
    env: {
      POST_ENABLED: postEnabled,
      DRY_RUN: dryRun,
      NODE_ENV: process.env.NODE_ENV ?? 'development',
    },
  });
};

const weeklySummaryHandler: Handler = (c) => {
  const summary = generateWeeklySummary();
  return c.json(summary.entries);
};

const adminAuth: MiddlewareHandler = async (c, next) => {
  if (!isAuthorized(c.req.raw)) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  await next();
};

const postDailyHandler: Handler = async (c) => {
  const lockName = 'daily-run';
  if (!acquireLock(lockName, 600)) {
    return c.json({ ok: false, error: 'locked' }, 409);
  }

  try {
    const result = await runDailyOnce();
    await flushPublishQueue();
    return c.json({
      ok: true,
      selected: result.selected,
      dryRun: result.dryRun,
      postEnabled: result.postEnabled,
    });
  } catch (err) {
    console.error('[admin/post-daily]', err);
    return c.json({ ok: false, error: 'internal_error' }, 500);
  } finally {
    releaseLock(lockName);
  }
};

const postWeeklyHandler: Handler = async (c) => {
  const summary = generateWeeklySummary();
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const message = formatWeeklyDigest(summary);

  try {
    if (postEnabled && !dryRun) {
      await Promise.allSettled([broadcast('PRO', message), broadcast('ELITE', message)]);
    }
    return c.json({ ok: true, dryRun, postEnabled });
  } catch (err) {
    console.error('[admin/post-weekly]', err);
    return c.json({ ok: false, error: 'internal_error' }, 500);
  }
};

const postNowHandler: Handler = async (c) => {
  const lockName = 'manual-run';
  if (!acquireLock(lockName, 600)) {
    return c.json({ ok: false, error: 'locked' }, 409);
  }

  try {
    const result = await runDailyOnce();
    if (result.postEnabled && !result.dryRun) {
      await flushPublishQueue();
    }
    return c.json({
      ok: true,
      messages: result.messages,
      dryRun: result.dryRun,
      postEnabled: result.postEnabled,
    });
  } catch (err) {
    console.error('[admin/post-now]', err);
    return c.json({ ok: false, error: 'internal_error' }, 500);
  } finally {
    releaseLock(lockName);
  }
};

app.get('/', (c) => c.json({ ok: true, version: APP_VERSION }));

aliasRoutes(app, 'GET', '/status', statusHandler);
aliasRoutes(app, 'GET', '/diagnostics', diagnosticsHandler);
aliasRoutes(app, 'GET', '/weekly-summary', weeklySummaryHandler);
aliasRoutes(app, 'POST', '/admin/post-now', adminAuth, postNowHandler);
aliasRoutes(app, 'POST', '/admin/post-daily', adminAuth, postDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-weekly', adminAuth, postWeeklyHandler);

function isAuthorized(req: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  return token === ADMIN_TOKEN;
}

function formatWeeklyDigest(summary: ReturnType<typeof generateWeeklySummary>) {
  const header = `📊 Weekly Recap`;
  const body = [
    `Signals: ${summary.count}`,
    `Win rate: ${summary.winRate5d !== null ? `${(summary.winRate5d * 100).toFixed(1)}%` : '—'}`,
    `Avg score: ${summary.avgScore ?? '—'}`,
    `Median score: ${summary.medianScore ?? '—'}`,
    `Top winners: ${summary.topWinners.map((w) => `${w.symbol} ${formatPnl(w.pnl)}`).join(' • ') || '—'}`,
    `Top losers: ${summary.topLosers.map((l) => `${l.symbol} ${formatPnl(l.pnl)}`).join(' • ') || '—'}`,
  ];
  return [header, ...body].join('\n');
}

function formatPnl(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch (err) {
    console.error('[status] failed to read version', err);
    return '0.0.0';
  }
}
