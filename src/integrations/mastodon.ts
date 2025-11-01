export async function sendMastodon(text: string) {
  const base = process.env.MASTODON_BASE
  const token = process.env.MASTODON_TOKEN
  if (!base || !token) return { ok:false, skipped:'mastodon env missing' }
  const r = await fetch(`${base.replace(/\/$/,'')}/api/v1/statuses`,{
    method:'POST',
    headers:{ 'authorization':`Bearer ${token}`, 'content-type':'application/json' },
    body: JSON.stringify({ status: text })
  })
  return { ok:r.ok, status:r.status }
}
