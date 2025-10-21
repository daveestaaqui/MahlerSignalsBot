export async function postDiscord(tier, text){
  const map = {
    FREE:  process.env.DISCORD_WEBHOOK_URL_FREE  || '',
    PRO:   process.env.DISCORD_WEBHOOK_URL_PRO   || '',
    ELITE: process.env.DISCORD_WEBHOOK_URL_ELITE || ''
  };
  const url = map[tier] || '';
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text })
    });
    return res.ok;
  } catch (err) {
    console.error('[discord] error', err?.message || err);
    return false;
  }
}
