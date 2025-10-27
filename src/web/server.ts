import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { setTier } from '../services/entitlement.js';
import { generateWeeklySummary } from '../services/weeklySummary.js';
import { acquireLock, releaseLock } from '../lib/locks.js';
import { runOnce } from '../jobs/runCycle.js';
import { flushPublishQueue } from '../jobs/publishWorker.js';

const app = new Hono();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function isAuthorized(req: Request){
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i,'');
  return Boolean(ADMIN_TOKEN && token === ADMIN_TOKEN);
}

// Landing/pricing
app.get('/', (c)=> c.json({ plans:[
  { tier:'FREE', price:'$0/mo' },
  { tier:'PRO', price:'$14/mo', checkout:'/checkout/pro' },
  { tier:'ELITE', price:'$39/mo', checkout:'/checkout/elite' }
]}));

// Placeholder checkout endpoints (replace with real Stripe Checkout URLs)
app.get('/checkout/pro', (c)=> c.json({ redirectTo:"https://your-stripe-checkout-link-for-pro" }));
app.get('/checkout/elite', (c)=> c.json({ redirectTo:"https://your-stripe-checkout-link-for-elite" }));

// Webhook placeholder: expects JSON {userId, tier}
app.post('/webhook/subscription', async (c)=>{
  const body = await c.req.json().catch(()=>null);
  if(!body?.userId || !body?.tier) return c.json({ok:false, error:'bad_payload'}, 400);
  setTier(body.userId, body.tier);
  return c.json({ok:true});
});

app.get('/status', (c)=> c.json({ ok:true, ts: Date.now()/1000 }));
app.get('/diagnostics', (c)=> c.json({
  ok: true,
  ts: Date.now()/1000,
  environment: {
    baseUrl: process.env.BASE_URL || null,
    postEnabled: process.env.POST_ENABLED || 'true',
    dryRun: process.env.DRY_RUN || 'false',
    alphavantage: Boolean(process.env.ALPHAVANTAGE_KEY),
    finnhub: Boolean(process.env.FINNHUB_KEY),
    polygon: Boolean(process.env.POLYGON_KEY),
    whaleAlert: Boolean(process.env.WHALE_ALERT_KEY),
    telegram: {
      token: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      free: Boolean(process.env.TELEGRAM_CHAT_ID_FREE),
      pro: Boolean(process.env.TELEGRAM_CHAT_ID_PRO),
      elite: Boolean(process.env.TELEGRAM_CHAT_ID_ELITE),
    }
  }
}));
app.get('/weekly-summary', (c)=> c.json(generateWeeklySummary()));

app.post('/admin/post-daily', async (c)=>{
  if(!isAuthorized(c.req.raw)) return c.json({ok:false, error:'unauthorized'}, 401);
  const lockName = 'daily-run';
  if(!acquireLock(lockName, 600)) return c.json({ok:false, error:'locked'}, 409);
  try {
    await runOnce();
    await flushPublishQueue();
    return c.json({ok:true});
  } catch (err) {
    console.error('[admin/post-daily]', err);
    return c.json({ok:false, error:'internal_error'}, 500);
  } finally {
    releaseLock(lockName);
  }
});

app.post('/admin/post-weekly', async (c)=>{
  if(!isAuthorized(c.req.raw)) return c.json({ok:false, error:'unauthorized'}, 401);
  const summary = generateWeeklySummary();
  return c.json({ok:true, summary});
});

const port = Number(process.env.PORT||8787);
serve({ fetch: app.fetch, port }, ()=> console.log(`HTTP on :${port}`));
