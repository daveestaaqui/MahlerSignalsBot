import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { Handler, MiddlewareHandler } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce, type RunDailyOptions, type DailyRunResult } from '../jobs/runDaily.js';
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

const previewDailyHandler: Handler = async (c) => {
  try {
    const result = await runDailyOnce({ preview: true });
    return sendDailyResponse(c, result, { preview: true });
  } catch (err) {
    console.error('[preview/daily]', err);
    return c.json(degradedPayload(err, { preview: true }), 200);
  }
};

const adminAuth: MiddlewareHandler = async (c, next) => {
  if (!isAuthorized(c.req.raw)) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  await next();
};

const postDailyHandler: Handler = async (c) => {
  const dryRunQuery = c.req.query('dry_run');
  if (isTruthy(dryRunQuery)) {
    try {
      const result = await runDailyOnce({ preview: true });
      return sendDailyResponse(c, result, { preview: true });
    } catch (err) {
      console.error('[admin/post-daily preview]', err);
      return c.json(degradedPayload(err, { preview: true }), 200);
    }
  }
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
      const flags = resolveFlags();
      const date = todayIso();
      const ledger = getLedgerCounts(date);
      const perAssetLimits = {
        stock: CADENCE.ENABLE_STOCKS_DAILY ? 1 : 0,
        crypto: CADENCE.ENABLE_CRYPTO_DAILY ? 1 : 0,
      } as const;
      const totalLimit =
        Number.isFinite(CADENCE.MAX_POSTS_PER_DAY) && CADENCE.MAX_POSTS_PER_DAY > 0
          ? CADENCE.MAX_POSTS_PER_DAY
          : perAssetLimits.stock + perAssetLimits.crypto;
      const capacityByAsset = {
        stock: {
          limit: perAssetLimits.stock,
          remaining: Math.max(perAssetLimits.stock - Math.min(ledger.stock, perAssetLimits.stock), 0),
        },
        crypto: {
          limit: perAssetLimits.crypto,
          remaining: Math.max(perAssetLimits.crypto - Math.min(ledger.crypto, perAssetLimits.crypto), 0),
        },
      };
      const totalUsed = Math.min(ledger.stock, perAssetLimits.stock) + Math.min(ledger.crypto, perAssetLimits.crypto);
      const totalRemaining = Math.max(totalLimit - totalUsed, 0);
      const nowSec = Math.floor(Date.now() / 1000);
      const result: DailyRunResult = {
        generatedAt: new Date().toISOString(),
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        preview: false,
        cadence: {
          date,
          limits: {
            total: totalLimit,
            byAsset: {
              stock: perAssetLimits.stock,
              crypto: perAssetLimits.crypto,
            },
          },
          before: {
            stock: ledger.stock ?? 0,
            crypto: ledger.crypto ?? 0,
          },
          after: {
            stock: ledger.stock ?? 0,
            crypto: ledger.crypto ?? 0,
          },
        },
        candidates: {
          total: 0,
          stock: 0,
          crypto: 0,
        },
        selected: [],
        rejected: [],
        capacity: {
          total: {
            limit: totalLimit,
            remaining: totalRemaining,
          },
          byAsset: capacityByAsset,
        },
        selectionMeta: {
          now: nowSec,
          cooldownCutoff: nowSec,
        },
        messages: [],
        dispatch: [],
        posted: 0,
        reason: 'no_capacity',
        providerErrors: [],
        errors: [],
        telemetry: [],
      };
      return sendDailyResponse(c, result);
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
aliasRoutes(app, 'GET', '/preview/daily', previewDailyHandler);
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
    return sendDailyResponse(c, result, extra);
  } catch (err) {
    console.error(`[${label}]`, err);
    return sendDailyError(c, err, extra);
  }
}

function resolveFlags() {
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  return { dryRun, postEnabled };
}

function sendDailyResponse(
  c: Parameters<Handler>[0],
  result: Awaited<ReturnType<typeof runDailyOnce>>,
  extra: Record<string, unknown> = {},
) {
  const errors = result.errors ?? [];
  const body = {
    ok: true,
    posted: result.posted,
    preview: result.preview,
    dryRun: result.dryRun,
    postEnabled: result.postEnabled,
    reason: result.reason,
    errors,
    degraded: errors.length > 0,
    selected: result.selected,
    rejected: result.rejected,
    dispatch: result.dispatch,
    cadence: result.cadence,
    capacity: result.capacity,
    messages: result.messages,
    telemetry: result.telemetry,
    ...extra,
  };
  return c.json(body, 200);
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

function isTruthy(value: string | null | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function sendDailyError(c: Parameters<Handler>[0], err: unknown, extra: Record<string, unknown> = {}) {
  const flags = resolveFlags();
  const error = {
    provider: 'internal',
    message: formatReason(err),
    retryInSec: 60,
  };
  return c.json(
    {
      ok: true,
      posted: 0,
      preview: false,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      reason: 'internal_error',
      errors: [error],
      degraded: true,
      ...extra,
    },
    200,
  );
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
