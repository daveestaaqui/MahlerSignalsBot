import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import adminRouter from './routes/admin.js';
import stripeHandler from './routes/stripe.js';

const app = express();

app.disable('x-powered-by');
app.use(bodyParser.json({ type: '*/*' }));

app.get('/status', (_req, res) => {
  res.json({ ok: true, ts: Date.now(), uptime: process.uptime() });
});

app.get('/healthz', (_req, res) => {
  res.status(200).end('ok');
});

app.get('/api/preview/daily', (_req, res) => {
  res.json({ ok: true, message: 'Daily preview placeholder' });
});

app.use('/admin', adminRouter);
app.post('/webhooks/stripe', stripeHandler);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'internal_error';
  console.error('[web] request failed', err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: message });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[web] listening on :${port}`);
});

export default app;
