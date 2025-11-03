import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import mountAdmin from './adminHono.js';

export const app = new Hono();
app.get('/status', (c) => c.json({ ok: true }));
app.get('/healthz', (c) => c.text('healthy'));

app.get('/test', (c) => c.json({ message: 'Test route works!' }));

mountAdmin(app);

export const setRunDailyRunner = (_fn?: any) => {};
export const resetRunDailyRunner = () => {};
serve({ fetch: app.fetch, port: 8787 });
export default app;
