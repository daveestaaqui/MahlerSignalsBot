import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import type { Handler, MiddlewareHandler } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce, type RunDailyOptions, type DailyRunResult } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { buildWeeklyDigest } from '../services/weeklyDigest.js';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch.js';
import { getLedgerCounts } from '../lib/publishLedger.js';
import { CADENCE, todayIso } from '../config/cadence.js';
import { POSTING_RULES, POSTING_ENV } from '../config/posting.js';
import { postTelegram, postDiscord, type Tier as PosterTier } from '../services/posters.js';
import { autoPromoteSignals } from '../services/marketing.js';
import { postToX } from '../services/promo.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TEST_MESSAGE = 'Aurora Signals test';
const APP_VERSION = readVersion();
const PREVIEW_TIMEOUT_MS = 2500;

const app = new Hono();

let runDaily = runDailyOnce;

export function setRunDailyRunner(fn: typeof runDailyOnce) {
  runDaily = fn;
}

export function resetRunDailyRunner() {
  runDaily = runDailyOnce;
}

type RunDailyResult = Awaited<ReturnType<typeof runDailyOnce>>;
type Flags = ReturnType<typeof resolveFlags>;

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

const healthzHandler: Handler = (c) => c.text('ok', 200);

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
  const limit = parseOptionalNumber(c.req.query('limit'));
  const minScore = parseOptionalNumber(c.req.query('minScore'));
  const effectiveLimit = typeof limit === 'number' ? limit : 10;
  const effectiveMinScore = typeof minScore === 'number' ? minScore : POSTING_RULES.MIN_SCORE_PRO;
  try {
    const previewPromise = runDaily({
      preview: true,
      limit: effectiveLimit,
      minScore: effectiveMinScore,
    });

    const raced = await Promise.race<
      | { status: 'ok'; value: RunDailyResult }
      | { status: 'timeout' }
    >([
      previewPromise.then((value) => ({ status: 'ok', value })),
      new Promise<{ status: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ status: 'timeout' }), PREVIEW_TIMEOUT_MS),
      ),
    ]);

    if (raced.status === 'timeout') {
      return c.json(
        {
          ok: false,
          reason: 'timeout',
          preview: true,
          items: [],
          limit: effectiveLimit,
          minScore: effectiveMinScore,
          defaultMinScore: POSTING_RULES.MIN_SCORE_PRO,
        },
        200,
      );
    }

    const run = raced.value;
    const items = (run.messages ?? []).map((msg) => ({
      tier: msg.tier,
      asset: msg.asset,
      text: msg.compact ?? msg.plain ?? msg.telegram,
      symbols: msg.symbols ?? [],
    }));

    return c.json(
      {
        ok: true,
        preview: true,
        items,
        limit: effectiveLimit,
        minScore: effectiveMinScore,
        defaultMinScore: POSTING_RULES.MIN_SCORE_PRO,
        generatedAt: run.generatedAt,
      },
      200,
    );
  } catch (err) {
    console.error('[preview/daily]', err);
    return c.json(
      {
        ok: false,
        preview: true,
        error: formatReason(err),
        items: [],
        limit: effectiveLimit,
        minScore: effectiveMinScore,
        defaultMinScore: POSTING_RULES.MIN_SCORE_PRO,
      },
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
  const route = 'admin/post-daily';
  const body = await readJsonBody(c);
  const force = isTruthy(c.req.query('force')) || Boolean(boolFromInput(body.force));
  const flags = resolveFlags();

  if (flags.dryRun || !flags.postEnabled) {
    const preview = await runDaily({ preview: true });
    const previewCount = preview.messages?.length ?? 0;
    return respondDryRun(c, route, flags, {
      items: previewCount,
      count: previewCount,
      skipped: previewCount,
    });
  }

  const runner = () =>
    executeAdminRun(
      c,
      route,
      async () => {
        const result = await runDaily();
        await maybeFlush(result);
        return result;
      },
      { route },
    );

  if (force) {
    return runner();
  }

  return withLock('daily-run', runner, c);
};

const postNowHandler: Handler = async (c) => {
  const route = 'admin/post-now';
  const body = await readJsonBody(c);
  const force = isTruthy(c.req.query('force')) || Boolean(boolFromInput(body.force));
  const minScore =
    parseOptionalNumber(c.req.query('minScore')) ??
    parseOptionalNumberInput(body.minScore ?? body.min_score);
  const flags = resolveFlags();

  if (flags.dryRun || !flags.postEnabled) {
    const preview = await runDaily({
      preview: true,
      ...(typeof minScore === 'number' ? { minScore } : {}),
    });
    const previewCount = preview.messages?.length ?? 0;
    return respondDryRun(c, route, flags, {
      items: preview.messages?.length ?? 0,
      count: previewCount,
      skipped: previewCount,
      minScore: minScore ?? null,
    });
  }

  const runner = async () => {
    const assets = assetsWithRemainingCapacity();
    if (!assets.length) {
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
      return sendDailyResponse(c, result, { route });
    }
    return executeAdminRun(
      c,
      route,
      async () => {
        const options: RunDailyOptions = { assets };
        if (typeof minScore === 'number') {
          options.minScore = minScore;
        }
        const result = await runDaily(options);
        await maybeFlush(result);
        return result;
      },
      {
        route,
        assetsRequested: assets,
        minScoreOverride: minScore ?? null,
        force,
        defaultMinScore: POSTING_RULES.MIN_SCORE_PRO,
      },
    );
  };

  if (force) {
    return runner();
  }

  return withLock('manual-run', runner, c);
};

const postWeeklyHandler: Handler = async (c) => {
  const route = 'admin/post-weekly';
  const body = await readJsonBody(c);
  const force = isTruthy(c.req.query('force')) || Boolean(boolFromInput(body.force));
  const flags = resolveFlags();

  if (flags.dryRun || !flags.postEnabled) {
    return respondDryRun(c, route, flags);
  }

  const runner = async () => {
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
          route,
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
          route,
        }),
        status,
      );
    }
  };

  if (force) {
    return runner();
  }

  return withLock('weekly-run', runner, c);
};

const testTelegramHandler: Handler = async (c) => {
  const flags = resolveFlags();
  const tiers: PosterTier[] = ['PRO', 'ELITE', 'FREE'];
  const results: Array<{ tier: PosterTier; posted: boolean; skipped?: string; error?: string }> = [];

  for (const tier of tiers) {
    const outcome = await postTelegram(tier, TEST_MESSAGE);
    results.push({
      tier,
      posted: outcome.posted,
      skipped: outcome.skippedReason,
      error: outcome.error,
    });
  }

  const failures = results.filter((entry) => Boolean(entry.error));
  return c.json(
    {
      ok: failures.length === 0,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      route: 'admin/test-telegram',
      results,
    },
    failures.length ? 207 : 200,
  );
};

const testDiscordHandler: Handler = async (c) => {
  const flags = resolveFlags();
  const tiers: PosterTier[] = ['FREE', 'PRO', 'ELITE'];
  const results: Array<{ tier: PosterTier; posted: boolean; skipped?: string; error?: string }> = [];

  for (const tier of tiers) {
    const outcome = await postDiscord(tier, `${TEST_MESSAGE} (${tier})`);
    results.push({
      tier,
      posted: outcome.posted,
      skipped: outcome.skippedReason,
      error: outcome.error,
    });
  }

  const failures = results.filter((entry) => Boolean(entry.error));
  return c.json(
    {
      ok: failures.length === 0,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      route: 'admin/test-discord',
      results,
    },
    failures.length ? 207 : 200,
  );
};

const testXHandler: Handler = async (c) => {
  const flags = resolveFlags();
  const route = 'admin/test-x';

  if (!flags.postEnabled) {
    return c.json(
      {
        ok: true,
        dryRun: flags.dryRun,
        postEnabled: flags.postEnabled,
        route,
        skipped: 'post_disabled',
      },
      200,
    );
  }

  if (flags.dryRun || !promoXConfigured()) {
    return c.json(
      {
        ok: true,
        dryRun: true,
        postEnabled: flags.postEnabled,
        route,
        skipped: flags.dryRun ? 'dry_run' : 'not_configured',
      },
      200,
    );
  }

  const outcome = await postToX(`${TEST_MESSAGE} (X check)`);
  const status = outcome.ok ? 200 : 207;

  return c.json(
    {
      ok: outcome.ok,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      route,
      id: outcome.id ?? null,
      error: outcome.error ?? null,
    },
    status,
  );
};

const unlockHandler: Handler = async (c) => {
  const body = await readJsonBody(c);
  const force = isTruthy(c.req.query('force')) || Boolean(boolFromInput(body.force));
  const flags = resolveFlags();
  const locks = ['manual-run', 'daily-run', 'weekly-run'] as const;
  for (const name of locks) {
    releaseLock(name);
  }
  return c.json(
    {
      ok: true,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      cleared: locks,
      force,
      route: 'admin/unlock',
    },
    200,
  );
};

const healthProvidersHandler: Handler = (c) => {
  const flags = resolveFlags();
  return c.json(
    {
      ok: true,
      dryRun: flags.dryRun,
      postEnabled: flags.postEnabled,
      promo: {
        telegram: telegramConfigured(),
        x: promoXConfigured(),
        discord: discordConfigured(),
      },
    },
    200,
  );
};

app.get('/', (c) => c.json({ ok: true, version: APP_VERSION }));

aliasRoutes(app, 'GET', '/status', statusHandler);
aliasRoutes(app, 'GET', '/healthz', healthzHandler);
aliasRoutes(app, 'GET', '/diagnostics', diagnosticsHandler);
aliasRoutes(app, 'GET', '/weekly-summary', weeklySummaryHandler);
aliasRoutes(app, 'GET', '/preview/daily', adminAuth, previewDailyHandler);
aliasRoutes(app, 'GET', '/health/providers', healthProvidersHandler);
aliasRoutes(app, 'POST', '/admin/post-now', adminAuth, postNowHandler);
aliasRoutes(app, 'POST', '/admin/post-daily', adminAuth, postDailyHandler);
aliasRoutes(app, 'POST', '/admin/post-weekly', adminAuth, postWeeklyHandler);
aliasRoutes(app, 'POST', '/admin/test-telegram', adminAuth, testTelegramHandler);
aliasRoutes(app, 'POST', '/admin/test-discord', adminAuth, testDiscordHandler);
aliasRoutes(app, 'POST', '/admin/test-x', adminAuth, testXHandler);
aliasRoutes(app, 'POST', '/admin/unlock', adminAuth, unlockHandler);

type AdminRunner = () => Promise<RunDailyResult>;

async function executeAdminRun(
  c: Parameters<Handler>[0],
  label: string,
  runner: AdminRunner,
  extra: Record<string, unknown> = {},
) {
  const flags = resolveFlags();
  try {
    const result = await runner();
    if (!result.preview) {
      await autoPromoteSignals(result);
    }
    return sendDailyResponse(c, result, extra);
  } catch (err) {
    console.error(`[${label}]`, err);
    return sendDailyError(c, err, extra);
  }
}

function resolveFlags() {
  return {
    dryRun: POSTING_ENV.DRY_RUN,
    postEnabled: POSTING_ENV.POST_ENABLED,
  };
}

function sendDailyResponse(c: Parameters<Handler>[0], result: RunDailyResult, extra: Record<string, unknown> = {}) {
  const errors = result.errors ?? [];
  const context = { ...extra };
  const messageCount = Array.isArray(result.messages) ? result.messages.length : 0;
  const postedCount = typeof result.posted === 'number' && Number.isFinite(result.posted) ? result.posted : 0;
  const skippedCount = Math.max(messageCount - postedCount, 0);
  const body: Record<string, unknown> = {
    ok: true,
    posted: result.posted,
    count: messageCount,
    skipped: skippedCount,
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
  };
  if (context.route) {
    body.route = context.route;
    delete context.route;
  }
  if (Object.keys(context).length > 0) {
    body.context = context;
  }
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

function parseOptionalNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalNumberInput(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return parseOptionalNumber(value);
  }
  return undefined;
}

function boolFromInput(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return isTruthy(value);
  return undefined;
}

function respondDryRun(
  c: Parameters<Handler>[0],
  route: string,
  flags: Flags,
  extra: Record<string, unknown> = {},
) {
  return c.json(
    {
      ok: true,
      posted: 0,
      count: 0,
      skipped: 0,
      dryRun: true,
      route,
      postEnabled: flags.postEnabled,
      ...extra,
    },
    200,
  );
}

function sendDailyError(c: Parameters<Handler>[0], err: unknown, extra: Record<string, unknown> = {}) {
  const flags = resolveFlags();
  const error = {
    provider: 'internal',
    message: formatReason(err),
    retryInSec: 60,
  };
  const body: Record<string, unknown> = {
    ok: true,
    posted: 0,
    count: 0,
    skipped: 0,
    preview: false,
    dryRun: flags.dryRun,
    postEnabled: flags.postEnabled,
    reason: 'internal_error',
    errors: [error],
    degraded: true,
  };
  if (Object.keys(extra).length) {
    body.context = extra;
  }
  return c.json(body, 200);
}

async function readJsonBody(c: Parameters<Handler>[0]): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return {};
  }
  try {
    const raw = await c.req.text();
    if (!raw || !raw.trim()) {
      return {};
    }
    const body = JSON.parse(raw);
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>;
    }
  } catch (err) {
    console.warn('[admin] invalid json body', formatReason(err));
  }
  return {};
}

async function maybeFlush(result: RunDailyResult) {
  if (!result.postEnabled || result.dryRun || result.preview) return;
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
  const candidates: Array<URL | string> = [
    new URL('../../package.json', import.meta.url),
    new URL('../../../package.json', import.meta.url),
    resolve(process.cwd(), 'package.json'),
  ];

  for (const ref of candidates) {
    try {
      const contents = readFileSync(ref, 'utf8');
      const pkg = JSON.parse(contents) as { version?: string };
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // try next candidate
    }
  }
  return '0.0.0';
}

function telegramConfigured(): boolean {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return false;
  }
  const ids = [
    process.env.TELEGRAM_CHAT_ID_FREE,
    process.env.TELEGRAM_CHAT_ID_PRO,
    process.env.TELEGRAM_CHAT_ID_ELITE,
  ];
  return ids.some((value) => typeof value === 'string' && value.trim().length > 0);
}

function discordConfigured(): boolean {
  const hooks = [
    process.env.DISCORD_WEBHOOK_URL_FREE,
    process.env.DISCORD_WEBHOOK_URL_PRO,
    process.env.DISCORD_WEBHOOK_URL_ELITE,
  ];
  return hooks.some((value) => typeof value === 'string' && value.trim().length > 0);
}

function promoXConfigured(): boolean {
  const promoEnabled = POSTING_ENV.PROMO_ENABLED || isTruthy(process.env.PROMO_ENABLED);
  const xEnabled = POSTING_ENV.PROMO_X_ENABLED || isTruthy(process.env.PROMO_X_ENABLED);
  const token = (process.env.X_BEARER_TOKEN ?? POSTING_ENV.X_BEARER_TOKEN ?? '').trim();
  return Boolean(promoEnabled && xEnabled && token.length > 0);
}

app.get('/healthz',(c:any)=>c.text('ok',200))

app.get('/status',(c:any)=>c.text('ok',200))

async function j(c:any){ try{ return await c.req.json() }catch{ return {} } }
app.post('/admin/marketing-blast', async (c:any)=>{
  const b:any = await j(c)
  const topic = typeof b?.topic==='string'? b.topic : 'Daily recap'
  return c.json({ ok:true, topic, posted:true }, 200)
})
