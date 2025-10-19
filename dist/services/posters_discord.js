import https from 'node:https';
function post(webhookUrl, content){
  return new Promise((resolve)=> {
    if(!webhookUrl) return resolve(false);
    try{
      const url = new URL(webhookUrl);
      const body = JSON.stringify({ content });
      const req = https.request({ method:'POST', hostname:url.hostname, path:url.pathname+url.search, headers:{
        'content-type':'application/json',
        'content-length': Buffer.byteLength(body)
      }}, res=>{res.on('data',()=>{}); res.on('end',()=>resolve(true));});
      req.on('error', ()=>resolve(false));
      req.write(body); req.end();
    }catch{ resolve(false); }
  });
}
export async function postDiscord(tier, text){
  const map = {
    FREE:  process.env.DISCORD_WEBHOOK_URL_FREE  || '',
    PRO:   process.env.DISCORD_WEBHOOK_URL_PRO   || '',
    ELITE: process.env.DISCORD_WEBHOOK_URL_ELITE || ''
  };
  return post(map[tier]||'', text);
}
