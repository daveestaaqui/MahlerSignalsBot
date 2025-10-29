import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { Handler, MiddlewareHandler } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce, type RunDailyOptions } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { buildWeeklyDigest } from '../services/weeklyDigest.js';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch.js';
import { getLedgerCounts } from '../lib/publishLedger.js';
import { CADENCE, todayIso } from '../config/cadence.js';

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

const statusHandler: Handler = (c) => {
  try {
    return c.json({
      ok: true,
      version: APP_VERSION,
      time: new Date().toISOString(),
      cadence: {
        maxPostsPerDay: CADENCE.MAX_POSTS_PER_DAY,
        enableStocks: CADENCE.ENABLE_STOCKS_DAILY,
        enableCrypto: CADENCE.ENABLE_CRYPTO_DAILY,
        timezone: CADENCE.TIMEZONE,
      },
    });
  } catch (err) {
    console.error('[status]', err);
    return c.json(degradedPayload(err), 200);
  }
};

const diagnosticsHandler: Handler = (c) => {
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
      },
      cadence: {
        date: today,
        ledger,
        maxPostsPerDay: CADENCE.MAX_POSTS_PER_DAY,
        timezone: CADENCE.TIMEZONE,
        cryptoMajors: CADENCE.CRYPTO_MAJOR_SYMBOLS,
      },
    });
  } catch (err) {
    console.error('[diagnostics]', err);
    return c.json(degradedPayload(err, { env: resolveFlags(), cadence: null }), 200);
  }
};

const weeklySummaryHandler: Handler = (c) => {
  try {
    const digest = buildWeeklyDigest();
    return c.json({
      ok: true,
      summary: digest.summary,
      message: digest.message,
    });
  } catch (err) {
    console.error('[weekly-summary]', err);
    return c.json(
      degradedPayload(err, {
        summary: null,
      }),
      200,
    );
  }
};

const adminAuth: MiddlewareHandler = async (c, next) => {
  if (!isAuthorized(c.req.raw)) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  await next();
};

const postDailyHandler: Handler = async (c) => {
  return withLock(
    'daily-run',
    () =>
      executeAdminRun(
        c,
        'admin/post-daily',
        async () => {
          const result = await runDailyOnce();
          await maybeFlush(result);
          return result;
        },
      ),
    c,
  );
};

const postNowHandler: Handler = async (c) => {
  return withLock('manual-run', async () => {
    const assets = assetsWithRemainingCapacity();
    if (!assets.length) {
      return c.json({
        ok: false,
        error: 'no_capacity',
        cadence: {
          date: todayIso(),
          ledger: getLedgerCounts(),
          limits: {
            total: CADENCE.MAX_POSTS_PER_DAY,
            stock: CADENCE.ENABLE_STOCKS_DAILY ? 1 : 0,
            crypto: CADENCE.ENABLE_CRYPTO_DAILY ? 1 : 0,
          },
        },
      }, 400);
    }
    return executeAdminRun(
      c,
      'admin/post-now',
      async () => {
        const result = await runDailyOnce({ assets } satisfies RunDailyOptions);
        await maybeFlush(result);
        return result;
      },
      { assetsRequested: assets },
    );
  }, c);
};

const postWeeklyHandler: Handler = async (c) => {
  const env = resolveFlags();
  try {
    const digest = await dispatchWeeklyDigest(env);
    const queued = env.postEnabled && !env.dryRun && digest.summary.count > 0;
    return c.json(
      {
        ok: true,
        queued,
        dryRun: env.dryRun,
        postEnabled: env.postEnabled,
        summary: digest.summary,
      },
      queued ? 202 : 200,
    );
  } catch (err) {
    console.error('[admin/post-weekly]', err);
    const status = env.postEnabled && !env.dryRun ? 202 : 200;
    return c.json(
      degradedPayload(err, {
        queued: env.postEnabled && !env.dryRun,
        dryRun: env.dryRun,
        postEnabled: env.postEnabled,
        summary: null,
      }),
      status,
    );
  }
};

app.get('/', (c) => c.json({ ok: true, version: APP_VERSION }));

aliasRoutes(app, 'GET', '/status', statusHandler);
aliasRoutes(app, 'GET', '/diagnostics', diagnosticsHandler);
aliasRoutes(app, 'GET', '/weekly-summary', weeklySummaryHandler);
aliasRoutes(app, 'POST', '/admin/post-now', adminAuth, postNowHandler);
aliasRoutes(app, 'POST', '/admin/post-daily', adminAuth, postDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-weekly', adminAuth, postWeeklyHandler);

type AdminRunner = () => Promise<Awaited<ReturnType<typeof runDailyOnce>>>;

async function executeAdminRun(
  c: Parameters<Handler>[0],
  label: string,
  runner: AdminRunner,
  extra: Record<string, unknown> = {},
) {
  const flags = resolveFlags();
  try {
    const result = await runner();
    const queued = result.postEnabled && !result.dryRun && result.messages.length > 0;
    const status = queued ? 202 : 200;
    return c.json(
      {
        ok: true,
        queued,
        dryRun: result.dryRun,
        postEnabled: result.postEnabled,
        cadence: result.cadence,
        selected: result.selected,
        capacity: result.capacity,
        messages: result.messages,
        ...extra,
      },
      status,
    );
  } catch (err) {
    console.error(`[${label}]`, err);
    const status = flags.postEnabled && !flags.dryRun ? 202 : 200;
    return c.json(
      degradedPayload(err, {
        queued: false,
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        ...extra,
      }),
      status,
    );
  }
}

function resolveFlags() {
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  return { dryRun, postEnabled };
}

function isAuthorized(req: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  return token === ADMIN_TOKEN;
}

async function withLock(name: string, fn: () => Promise<Response>, c: Parameters<Handler>[0]) {
  if (!acquireLock(name, 600)) {
    return c.json({ ok: false, error: 'locked' }, 409);
  }
  try {
    return await fn();
  } catch (err) {
    console.error(`[${name}] unexpected`, err);
    const flags = resolveFlags();
    const status = flags.postEnabled && !flags.dryRun ? 202 : 200;
    return c.json(
      degradedPayload(err, {
        queued: false,
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
      }),
      status,
    );
  } finally {
    releaseLock(name);
  }
}

function assetsWithRemainingCapacity() {
  try {
    const ledger = getLedgerCounts();
    const assets: Array<'stock' | 'crypto'> = [];
    if (CADENCE.ENABLE_STOCKS_DAILY && ledger.stock < 1) {
      assets.push('stock');
    }
    if (CADENCE.ENABLE_CRYPTO_DAILY && ledger.crypto < 1) {
      assets.push('crypto');
    }
    return assets;
  } catch (err) {
    console.warn('[assetsWithRemainingCapacity] fallback', formatReason(err));
    const fallback: Array<'stock' | 'crypto'> = [];
    if (CADENCE.ENABLE_STOCKS_DAILY) fallback.push('stock');
    if (CADENCE.ENABLE_CRYPTO_DAILY) fallback.push('crypto');
    return fallback;
  }
}

async function maybeFlush(result: Awaited<ReturnType<typeof runDailyOnce>>) {
  if (!result.postEnabled || result.dryRun) return;
  if (!result.messages.length) return;
  await flushPublishQueue();
}

function degradedPayload(reason: unknown, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    degraded: true,
    reason: formatReason(reason),
    ...extra,
  };
}

function formatReason(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message || reason.name || 'unknown-error';
  }
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return 'unknown-error';
  }
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
