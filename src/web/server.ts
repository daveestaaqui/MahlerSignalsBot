import { Hono } from 'hono';
import { serve } from '@hono/node-server';
export const app = new Hono();
app.get('/status', (c) => c.json({ ok: true }));
app.get('/healthz', (c) => c.text('healthy'));
export const setRunDailyRunner = (_fn?: any) => {};
export const resetRunDailyRunner = () => {};
serve({ fetch: app.fetch, port: 8787 });
export default app;
