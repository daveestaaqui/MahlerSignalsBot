export async function postTelegram(tier, text){
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatMap = {
    FREE:  process.env.TELEGRAM_CHAT_ID_FREE  || '',
    PRO:   process.env.TELEGRAM_CHAT_ID_PRO   || '',
    ELITE: process.env.TELEGRAM_CHAT_ID_ELITE || ''
  };
  const chat = chatMap[tier] || '';
  if (!token || !chat) return false;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = new URLSearchParams({ chat_id: chat, text, disable_web_page_preview: 'true' });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    });
    return res.ok;
  } catch (err) {
    console.error('[telegram] error', err?.message || err);
    return false;
  }
}
