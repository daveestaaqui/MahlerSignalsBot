/**
 * Clean web server (ESM) with two modes:
 *  - Hono (if available) using @hono/node-server
 *  - Fallback: native http server
 * Routes:
 *   GET  /                       -> static index.html (or JSON plans)
 *   GET  /checkout/pro|elite     -> redirects to env URLs
 *   GET  /api/signals?tier=...   -> JSON; FREE delayed 24h
 *   GET  /status                 -> { counts, last }
 *   POST /admin/post             -> trigger a run cycle
 */
import { setTier } from '../services/entitlement.js';
import { createCheckoutSession, verifyStripeSignature } from '../services/stripe.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const PRO_URL   = process.env.CHECKOUT_PRO_URL   || 'https://example.com/pro';
const ELITE_URL = process.env.CHECKOUT_ELITE_URL || 'https://example.com/elite';

async function withDb(fn) {
  try { const { default: db } = await import('../lib/db.js'); return await fn(db); }
  catch { return await fn(null); }
}
async function getSignals(limit=50) {
  return withDb(async (db) => {
    try {
      const rows = db?.prepare?.("SELECT ts,chain,symbol,score,tier FROM signals ORDER BY ts DESC LIMIT ?")?.all?.(limit) || [];
      return rows.map(r => ({ ts:r.ts, chain:r.chain, symbol:r.symbol, score:r.score, tier:r.tier }));
    } catch { return []; }
  });
}
async function getStatus() {
  return withDb(async (db) => {
    try {
      const users = db?.prepare?.("SELECT COUNT(*) as c FROM users")?.get?.()?.c ?? 0;
      const info  = db?.prepare?.("SELECT COUNT(*) as c, MAX(ts) as m FROM signals")?.get?.() || { c:0, m:null };
      return { counts:{ users, signals:info.c }, last:info.m };
    } catch { return { counts:{ users:0, signals:0 }, last:null }; }
  });
}
async function triggerRunOnce() {
  try { const { runOnce } = await import('../jobs/runCycle.js'); await runOnce(); } catch {}
}

let Hono, serve;
try { ({ Hono } = await import('hono')); ({ serve } = await import('@hono/node-server')); } catch {}

if (Hono && serve) {
  // ---- Hono branch -----------------------------------------------------------
  const app = new Hono();

  app.get('/', async (c) => {
    try {
      const fs = await import('node:fs/promises');
      const html = await fs.readFile('dist/web/public/index.html', 'utf8');
      return c.html(html);
    } catch {
      return c.json({ plans:[
        { tier:'FREE',  price:'$0/mo' },
        { tier:'PRO',   price:'$14/mo' },
        { tier:'ELITE', price:'$39/mo' },
      ]});
    }
  });

  app.get('/checkout/pro',   (c)=> c.redirect(PRO_URL, 302));
  app.get('/checkout/elite', (c)=> c.redirect(ELITE_URL, 302));

  app.get('/api/signals', async (c) => {
    const tier = (c.req.query('tier') || 'free').toUpperCase();
    const now = Date.now();
    const items = await getSignals(50);
    const filtered = tier === 'FREE'
      ? items.filter(x => (now - new Date(x.ts).getTime()) >= 24*60*60*1000)
      : items;
    return c.json({ tier, items: filtered });
  });

  app.get('/robots.txt', (c)=> c.text('User-agent: *\nDisallow: /', 200));
  app.get('/status', async (c) => c.json(await getStatus()));
  app.get('/stripe/create-session', async (c)=>{
    const tier=(c.req.query('tier')||'').toUpperCase();
    const priceMap = { PRO: process.env.PRICE_PRO_MONTHLY, ELITE: process.env.PRICE_ELITE_MONTHLY };
    const priceId = priceMap[tier];
    const base = process.env.BASE_URL || 'https://aurora-signals.onrender.com';
    if(!priceId) return c.json({ ok:false, error:'missing_price' }, 400);
    const session = await createCheckoutSession({ priceId, successUrl: `${base}/?ok=1`, cancelUrl: `${base}/?cancel=1` });
    return c.json(session, session.ok ? 200 : 400);
  });
  app.post('/webhook/stripe', async (c)=>{
    const raw = await c.req.text();
    const sig = c.req.header('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if(!verifyStripeSignature(raw, sig, secret)) return c.text('bad signature', 400);
    try{
      const body = JSON.parse(raw || '{}');
      const line = body?.data?.object?.lines?.data?.[0];
      const priceId = line?.price?.id;
      const tier = priceId && priceId === process.env.PRICE_ELITE_MONTHLY ? 'ELITE' : 'PRO';
      const customer = body?.data?.object?.customer_email || body?.data?.object?.customer || '';
      if(customer) await setTier(String(customer), tier);
    }catch(err){ console.error('[stripe webhook]', err?.message || err); }
    return c.text('ok', 200);
  });

  app.post('/admin/post', async (c) => {
    const auth = c.req.header('authorization') || '';
    const tok = auth.replace(/^Bearer\s+/i,'').trim();
    if(!process.env.ADMIN_TOKEN || tok !== process.env.ADMIN_TOKEN) return c.json({ok:false,error:'unauthorized'},401);
    await triggerRunOnce();
    return c.json({ ok:true });
  });

  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () =>
    console.log(`HTTP (Hono) on ${HOST}:${PORT}`)
  );

} else {
  // ---- Fallback node:http branch ---------------------------------------------
  const http = await import('node:http');
  const fs = await import('node:fs/promises');

  const srv = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/robots.txt') {
        res.writeHead(200, {'content-type':'text/plain'}); res.end('User-agent: *\nDisallow: /'); return;
      }
      // Static UI
      if (req.method === 'GET' && url.pathname === '/') {
        try {
          const html = await fs.readFile('dist/web/public/index.html', 'utf8');
          res.writeHead(200, { 'content-type':'text/html; charset=utf-8' });
          res.end(html); return;
        } catch {
          res.writeHead(200, { 'content-type':'application/json' });
          res.end(JSON.stringify({ plans:[
            { tier:'FREE',  price:'$0/mo' },
            { tier:'PRO',   price:'$14/mo' },
            { tier:'ELITE', price:'$39/mo' },
          ]})); return;
        }
      }
      // Checkout redirects
      if (req.method === 'GET' && url.pathname === '/checkout/pro')   { res.writeHead(302, { Location: PRO_URL });   res.end(); return; }
      if (req.method === 'GET' && url.pathname === '/checkout/elite') { res.writeHead(302, { Location: ELITE_URL }); res.end(); return; }

      // API: signals (FREE delayed 24h)
      if (req.method === 'GET' && url.pathname === '/api/signals') {
        const tier = (url.searchParams.get('tier') || 'free').toUpperCase();
        const now = Date.now();
        const items = await getSignals(50);
        const filtered = tier === 'FREE'
          ? items.filter(x => (now - new Date(x.ts).getTime()) >= 24*60*60*1000)
          : items;
        res.writeHead(200, { 'content-type':'application/json' });
        res.end(JSON.stringify({ tier, items: filtered })); return;
      }

      // Status
      if (req.method === 'GET' && url.pathname === '/status') {
        res.writeHead(200, { 'content-type':'application/json' });
        res.end(JSON.stringify(await getStatus())); return;
      }

      if (req.method === 'GET' && url.pathname === '/stripe/create-session') {
        const tier = (url.searchParams.get('tier') || '').toUpperCase();
        const priceMap = { PRO: process.env.PRICE_PRO_MONTHLY, ELITE: process.env.PRICE_ELITE_MONTHLY };
        const priceId = priceMap[tier];
        const base = process.env.BASE_URL || 'https://aurora-signals.onrender.com';
        if(!priceId){ res.writeHead(400, {'content-type':'application/json'}); res.end(JSON.stringify({ ok:false, error:'missing_price' })); return; }
        const session = await createCheckoutSession({ priceId, successUrl: `${base}/?ok=1`, cancelUrl: `${base}/?cancel=1` });
        res.writeHead(session.ok?200:400, {'content-type':'application/json'}); res.end(JSON.stringify(session)); return;
      }

      if (req.method === 'POST' && url.pathname === '/webhook/stripe') {
        let raw=''; req.on('data',c=>raw+=c);
        req.on('end', async ()=>{
          const sig = req.headers['stripe-signature'];
          const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
          if(!verifyStripeSignature(raw, Array.isArray(sig)?sig[0]:sig, secret)) { res.writeHead(400); res.end('bad signature'); return; }
          try{
            const body = JSON.parse(raw||'{}');
            const line = body?.data?.object?.lines?.data?.[0];
            const priceId = line?.price?.id;
            const tier = (priceId && priceId === process.env.PRICE_ELITE_MONTHLY) ? 'ELITE' : 'PRO';
            const customer = body?.data?.object?.customer_email || body?.data?.object?.customer || '';
            if(customer) await setTier(String(customer), tier);
          }catch(err){ console.error('[stripe webhook fallback]', err?.message || err); }
          res.writeHead(200); res.end('ok');
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/admin/post') {
        const auth = req.headers['authorization'] || '';
        const tok = (Array.isArray(auth)?auth[0]:auth).replace(/^Bearer\s+/i,'').trim();
        if(!process.env.ADMIN_TOKEN || tok !== process.env.ADMIN_TOKEN){ res.writeHead(401); res.end('unauthorized'); return; }
        await triggerRunOnce();
        res.writeHead(200, { 'content-type':'application/json' });
        res.end(JSON.stringify({ ok:true })); return;
      }

      res.writeHead(404); res.end('Not Found');
    } catch (e) {
      res.writeHead(500); res.end('Server error');
    }
  });

  srv.listen(PORT, HOST, () => console.log(`HTTP (fallback) on ${HOST}:${PORT}`));
}
