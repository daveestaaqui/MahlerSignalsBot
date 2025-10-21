import https from 'node:https';
import crypto from 'node:crypto';

export function verifyStripeSignature(rawBody, signatureHeader, secret){
  try{
    if(!signatureHeader || !secret) return false;
    const parts = Object.fromEntries(signatureHeader.split(',').map(pair => pair.split('=')).map(([k,v])=>[k.trim(), (v||'').trim()]));
    const payload = `${parts.t}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if(!parts.v1) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  }catch(err){
    console.error('[stripe] verify error', err?.message || err);
    return false;
  }
}

export function createCheckoutSession({ priceId, successUrl, cancelUrl }){
  return new Promise((resolve) => {
    const key = process.env.STRIPE_SECRET_KEY || '';
    if(!key) return resolve({ ok:false, error:'missing_key' });
    if(!priceId) return resolve({ ok:false, error:'missing_price' });
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: 'true'
    }).toString();
    const req = https.request({
      method:'POST',
      hostname:'api.stripe.com',
      path:'/v1/checkout/sessions',
      headers:{
        'authorization':'Basic ' + Buffer.from(key + ':').toString('base64'),
        'content-type':'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(params)
      }
    }, res => {
      let body=''; res.on('data', c=>body+=c);
      res.on('end', ()=>{
        try{ const parsed = JSON.parse(body); resolve({ ok: res.statusCode>=200 && res.statusCode<300, ...parsed }); }
        catch(err){ resolve({ ok:false, error:'bad_json', raw: body }); }
      });
    });
    req.on('error', err => resolve({ ok:false, error: err.message }));
    req.write(params); req.end();
  });
}
