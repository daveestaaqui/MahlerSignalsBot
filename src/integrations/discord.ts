
export async function sendDiscord(text: string) {
  const hook = process.env.DISCORD_WEBHOOK_URL
  if (!hook) return { ok:false, skipped:'discord env missing' }
  const r = await fetch(hook,{ method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ content: text.slice(0,1900) }) })
  return { ok:r.ok, status:r.status }
}
