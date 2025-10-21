import crypto from 'node:crypto';
function enc(v){ return encodeURIComponent(v).replace(/[!*()']/g, c => `%${c.charCodeAt(0).toString(16)}`); }
function signature({ method, url, params, consumerSecret, tokenSecret }){
  const baseString = [method.toUpperCase(), enc(url), enc(Object.keys(params).sort().map(k => `${enc(k)}=${enc(params[k])}`).join('&'))].join('&');
  const key = `${enc(consumerSecret)}&${enc(tokenSecret || '')}`;
  return crypto.createHmac('sha1', key).update(baseString).digest('base64');
}
export async function postX(text){
  const apiKey     = process.env.X_API_KEY;
  const apiSecret  = process.env.X_API_SECRET;
  const accessTok  = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if(!apiKey || !apiSecret || !accessTok || !accessSecret) return false;
  const url = 'https://api.twitter.com/1.1/statuses/update.json';
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now()/1000).toString(),
    oauth_token: accessTok,
    oauth_version: '1.0'
  };
  const params = { ...oauth, status: text };
  const oauthSignature = signature({ method:'POST', url, params, consumerSecret: apiSecret, tokenSecret: accessSecret });
  const authHeader = 'OAuth ' + Object.entries({ ...oauth, oauth_signature: oauthSignature })
    .map(([k,v]) => `${enc(k)}="${enc(v)}"`).join(', ');
  try {
    const body = new URLSearchParams({ status: text });
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Authorization': authHeader, 'content-type':'application/x-www-form-urlencoded' },
      body
    });
    if(!res.ok){
      console.error('[x] status', res.status);
    }
    return res.ok;
  } catch (err) {
    console.error('[x] error', err?.message || err);
    return false;
  }
}
