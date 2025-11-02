import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import stripe from './stripe.js';
export const app = new Hono();

app.get('/status', (c) => c.text('OK'));
app.get('/healthz', (c) => c.text('healthy'));

app.route('/', stripe);

serve({ fetch: app.fetch, port: 8787 });
export default app;
