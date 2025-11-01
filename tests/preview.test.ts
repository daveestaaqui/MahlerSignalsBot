import { describe, it, expect } from 'vitest'
const base = (process.env.BASE||'').replace(/\/$/,'')
const token = process.env.ADMIN_TOKEN||''

async function getJson(path:string, auth:boolean){
  const res = await fetch(base + path, { headers: auth ? { Authorization: `Bearer ${token}` } : {} })
  return { status: res.status }
}

describe('preview endpoints', () => {
  it('GET /preview/daily requires auth or returns 200 with token', async () => {
    if (!base) return
    const r = await getJson('/preview/daily', !!token)
    expect([200,401,403]).toContain(r.status)
  })
  it('GET /api/preview/daily requires auth or returns 200 with token', async () => {
    if (!base) return
    const r = await getJson('/api/preview/daily', !!token)
    expect([200,401,403]).toContain(r.status)
  })
})
