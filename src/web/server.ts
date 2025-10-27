import { Hono } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runDailyOnce } from '../jobs/runDaily.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';
import { generateWeeklySummary } from '../services/weeklySummary.js';
import { POSTING_RULES } from '../config/posting.js';
import { broadcast } from '../services/posters.js';

const app = new Hono();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

app.get('/', (c) => c.json({ ok: true }));

app.get('/status', (c) => c.json({ ok: true, ts: Date.now() }));

app.get('/diagnostics', (c) => {
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  return c.json({
    ok: true,
    ts: Date.now(),
    env: {
      POST_ENABLED: postEnabled,
      DRY_RUN: dryRun,
      DAILY_POST_CAP: POSTING_RULES.DAILY_POST_CAP,
    },
  });
});

app.get('/weekly-summary', (c) => {
  const summary = generateWeeklySummary();
  return c.json({ ok: true, summary });
});

app.post('/admin/post-daily', async (c) => {
  if (!isAuthorized(c.req.raw)) return c.json({ ok: false, error: 'unauthorized' }, 401);

  const lockName = 'daily-run';
  if (!acquireLock(lockName, 600)) return c.json({ ok: false, error: 'locked' }, 409);

  try {
    const result = await runDailyOnce();
    await flushPublishQueue();
    return c.json({ ok: true, selected: result.selected, dryRun: result.dryRun, postEnabled: result.postEnabled });
  } catch (err) {
    console.error('[admin/post-daily]', err);
    return c.json({ ok: false, error: 'internal_error' }, 500);
  } finally {
    releaseLock(lockName);
  }
});

app.post('/admin/post-weekly', async (c) => {
  if (!isAuthorized(c.req.raw)) return c.json({ ok: false, error: 'unauthorized' }, 401);

  const summary = generateWeeklySummary();
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  const message = formatWeeklyDigest(summary);

  try {
    if (postEnabled && !dryRun) {
      await Promise.allSettled([
        broadcast('PRO', message),
        broadcast('ELITE', message),
      ]);
    }
    return c.json({ ok: true, dryRun, postEnabled });
  } catch (err) {
    console.error('[admin/post-weekly]', err);
    return c.json({ ok: false, error: 'internal_error' }, 500);
  }
});

export default app;

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
