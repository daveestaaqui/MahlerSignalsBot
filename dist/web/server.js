import { Hono } from 'hono';
const app = new Hono();
app.get('/status', (c) => c.json({ ok: true, ts: Date.now() }));
app.get('/diagnostics', (c) => c.json({ ok: true, env: { POST_ENABLED: process.env.POST_ENABLED === 'true', DRY_RUN: process.env.DRY_RUN === 'true' } }));
app.get('/weekly-summary', (c) => c.json({ ok: true, summary: "coming-soon" }));
app.post('/admin/post-daily', (c) => { const a = c.req.header('authorization') || ''; if (!a.includes('Bearer ') || a.split(' ')[1] !== process.env.ADMIN_TOKEN)
    return c.text('unauthorized', 401); return c.json({ ok: true, run: 'daily' }); });
app.post('/admin/post-weekly', (c) => { const a = c.req.header('authorization') || ''; if (!a.includes('Bearer ') || a.split(' ')[1] !== process.env.ADMIN_TOKEN)
    return c.text('unauthorized', 401); return c.json({ ok: true, run: 'weekly' }); });
export default app;
