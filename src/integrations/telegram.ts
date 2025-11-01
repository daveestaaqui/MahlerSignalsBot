export async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok:false, skipped:'telegram env missing' }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const r = await fetch(url,{ method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ chat_id: chatId, text }) })
  return { ok:r.ok, status:r.status }
}
