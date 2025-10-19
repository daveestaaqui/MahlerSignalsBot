import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { setTier } from '../services/entitlement.js';
import { PRICE_MAP } from '../config/pricing.js';

const app = new Hono();

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

const port = Number(process.env.PORT||8787);
serve({ fetch: app.fetch, port }, ()=> console.log(`HTTP on :${port}`));
