
export async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const idsRaw = process.env.TELEGRAM_CHAT_IDS
    || [process.env.TELEGRAM_CHAT_ID_FREE, process.env.TELEGRAM_CHAT_ID_PRO, process.env.TELEGRAM_CHAT_ID_ELITE]
         .filter(Boolean).join(',')
  const ids = (idsRaw||'').split(',').map(s=>s.trim()).filter(Boolean)
  if (!token || !ids.length) return { ok:false, skipped:'telegram env missing' }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const results: any[] = []
  for (const chat_id of ids) {
    const r = await fetch(url,{ method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ chat_id, text }) })
    results.push({ chat_id, ok:r.ok, status:r.status })
  }
  const ok = results.some(r=>r.ok)
  return { ok, results }
}
