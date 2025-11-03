import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Context } from 'hono';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { postNow, postDaily } from './jobs.js';
import { runWeekly } from '../jobs/scheduler.js';
import { sendTelegram } from '../integrations/telegram.js';
import { sendDiscord } from '../integrations/discord.js';

export const app = new Hono();
app.get('/status', (c) => c.json({ ok: true }));
app.get('/healthz', (c) => c.text('healthy'));

// Admin authentication middleware for Hono
async function adminAuth(c: Context, next: Function) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== (process.env.ADMIN_TOKEN || '')) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  await next();
}

const admin = new Hono();
admin.use(adminAuth);

app.post('/admin/post-now', async (c) => {

  const force = c.req.query('force') === 'true';

  const minScore = Number(c.req.query('minScore') || 0);

  const r = await postNow();

  return c.json({ ok: true, results: r });

});



app.post('/admin/post-daily', async (c) => {

  const dryRun = c.req.json().then((body: any) => body.dryRun === true).catch(() => false);

  const r = await postDaily(await dryRun);

  return c.json({ ok: true, results: r });

});



app.post('/admin/post-weekly', async (c) => {

  const dryRun = c.req.json().then((body: any) => body.dryRun === true).catch(() => false);

  const r = await runWeekly(); // runWeekly does not take dryRun as a parameter

  return c.json({ ok: true });

});



app.post('/admin/test-telegram', async (c) => {

  const r = await sendTelegram("Test message from admin endpoint");

  return c.json({ ok: true, ...r });

});



app.post('/admin/test-discord', async (c) => {

  const r = await sendDiscord("Test message from admin endpoint");

  return c.json({ ok: true, ...r });

});



app.post('/admin/unlock', async (c) => {

  let force = false;

  try {

    const q = c.req.query('force');

    if (q && (q === '1' || q === 'true')) force = true;

    const body = await c.req.json().catch(() => ({} as any));

    if (body && (body.force === true || body.force === 'true' || body.force === 1)) force = true;

  } catch {}

  const locks = ['daily-run', 'manual-run'];

  const cleared: string[] = [];

  try {

    for (const name of locks) {

      if (force) {

        releaseLock(name);

        cleared.push(name);

      } else {

        const got = acquireLock(name, 1);

        if (got) {

          releaseLock(name);

          cleared.push(name);

        }

      }

    }

    return c.json({ ok: true, cleared, force }, 200);

  } catch (err: any) {

    return c.json({ ok: false, error: err.message || 'unknown-error' }, 500);

  }

});

export const setRunDailyRunner = (_fn?: any) => {};
export const resetRunDailyRunner = () => {};
serve({ fetch: app.fetch, port: 8787 });
export default app;
