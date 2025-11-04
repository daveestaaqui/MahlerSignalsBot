import { Router, Request, Response, NextFunction } from 'express';
import { acquireLock, releaseLock } from '../../lib/locks.js';
import { postNow, postDaily } from '../jobs.js';
import { dispatchWeeklyDigest } from '../../services/weeklyDispatch.js';
import { sendTelegram } from '../../integrations/telegram.js';
import { sendDiscord } from '../../integrations/discord.js';

type BooleanLike = boolean | string | number | undefined | null | string[];

const adminRouter = Router();

const normalizeBoolean = (value: BooleanLike, fallback = false): boolean => {
  if (Array.isArray(value)) return normalizeBoolean(value[0], fallback);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const readDryRun = (req: Request): boolean => {
  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = body?.dryRun as BooleanLike;
  const fromQuery = req.query?.dryRun as BooleanLike;
  return normalizeBoolean(fromBody ?? fromQuery, false);
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const configured = (process.env.ADMIN_TOKEN ?? '').trim();
  const token = (req.headers.authorization ?? '').trim();
  const expected = configured ? `Bearer ${configured}` : '';
  if (!configured || token !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
};

const toAsyncNoContent =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

const isPostEnabled = () => normalizeBoolean(process.env.POST_ENABLED, true);

adminRouter.use(requireAdmin);

adminRouter.post(
  '/post-now',
  toAsyncNoContent(async (req) => {
    await postNow({ dryRun: readDryRun(req) });
  }),
);

adminRouter.post(
  '/post-daily',
  toAsyncNoContent(async (req) => {
    await postDaily({ dryRun: readDryRun(req) });
  }),
);

adminRouter.post(
  '/post-weekly',
  toAsyncNoContent(async (req) => {
    const dryRun = readDryRun(req);
    await dispatchWeeklyDigest({
      dryRun,
      postEnabled: dryRun ? false : isPostEnabled(),
    });
  }),
);

adminRouter.post(
  '/test-telegram',
  toAsyncNoContent(async (req) => {
    if (readDryRun(req)) return;
    const body = req.body as Record<string, unknown> | undefined;
    const message =
      typeof body?.message === 'string'
        ? String((body as Record<string, string>).message)
        : 'Test message from admin endpoint';
    await sendTelegram(message);
  }),
);

adminRouter.post(
  '/test-discord',
  toAsyncNoContent(async (req) => {
    if (readDryRun(req)) return;
    const body = req.body as Record<string, unknown> | undefined;
    const message =
      typeof body?.message === 'string'
        ? String((body as Record<string, string>).message)
        : 'Test message from admin endpoint';
    await sendDiscord(message);
  }),
);

adminRouter.post(
  '/unlock',
  toAsyncNoContent(async (req) => {
    const body = req.body as Record<string, unknown> | undefined;
    const force = normalizeBoolean((body?.force as BooleanLike) ?? (req.query?.force as BooleanLike), false);
    const locks = ['daily-run', 'manual-run'];
    for (const name of locks) {
      if (force) {
        releaseLock(name);
        continue;
      }
      const acquired = acquireLock(name, 1);
      if (acquired) {
        releaseLock(name);
      }
    }
  }),
);

export default adminRouter;
