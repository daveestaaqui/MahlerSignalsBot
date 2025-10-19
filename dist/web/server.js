let Hono, serve; try { ({ Hono } = await import('hono')); ({ serve } = await import('@hono/node-server')); } catch {}
import { setTier } from '../services/entitlement.js';
const pricing = [{tier:'FREE', price:'$0/mo'},{tier:'PRO', price:'$14/mo', checkout:'/checkout/pro'},{tier:'ELITE', price:'$39/mo', checkout:'/checkout/elite'}];
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
if (Hono && serve) {
  const app = new Hono();
  app.get('/', c=> c.json({plans: pricing}));
  app.get('/checkout/pro',  c=> c.json({ redirectTo:"https://your-stripe-checkout-link-for-pro" }));
  app.get('/checkout/elite',c=> c.json({ redirectTo:"https://your-stripe-checkout-link-for-elite" }));
  app.post('/webhook/subscription', async c=>{ const b = await c.req.json().catch(()=>null);
    if(!b?.userId || !b?.tier) return c.json({ok:false,error:'bad_payload'},400); setTier(b.userId,b.tier); return c.json({ok:true}); });
  serve({ fetch: app.fetch, port, hostname: host }, ()=> console.log(`HTTP on ${host}:${port}`));
} else {
  // Minimal fallback server
  const http = await import('node:http');
  const srv = http.createServer((req,res)=>{
    if (req.url === '/' && req.method === 'GET') {
      res.setHeader('content-type','application/json'); res.end(JSON.stringify({plans: pricing}));
      return;
    }
    if (req.url === '/admin/post' && req.method === 'POST') {
      import('../jobs/runCycle.js').then(({ runOnce })=> runOnce().catch(()=>{}));
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    res.statusCode=404;
    res.end('Not Found');
  });
  srv.listen(port, host, ()=>console.log(`HTTP (fallback) on ${host}:${port}`));
}

// Admin trigger to run a cycle immediately
try {
  import("../jobs/runCycle.js").then(({ runOnce })=>{
    app?.post && app.post("/admin/post", async (c)=>{
      await runOnce().catch(()=>{});
      return c?.json ? c.json({ok:true}) : (c.res.end("ok"));
    });
  });
} catch(e) {
  // fallback http server branch handled below if Hono unavailable
}
