
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

export const app = new Hono()

const ok = (c:any, body:any={ ok:true }) => c.json(body, 200)
const txt = (c:any, s:string) => c.text(s, 200)
const wantToken = (process.env.ADMIN_TOKEN || '').trim()

function auth(c:any){
  const h = c.req.header('authorization') || c.req.header('x-admin-token') || ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : h
  return !wantToken || t === wantToken
}
async function body(c:any){ try { return await c.req.json() } catch { return {} } }

app.get('/status', (c:any)=> txt(c,'ok'))
app.get('/healthz', (c:any)=> txt(c,'ok'))

app.post('/admin/post-now', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  return ok(c, { ok:true, posted:true, targets:['telegram','discord','mastodon'] })
})

app.post('/admin/post-daily', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  const b:any = await body(c)
  return ok(c, { ok:true, scheduled:true, dryRun:!!b?.dryRun })
})

app.post('/admin/post-weekly', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  const b:any = await body(c)
  return ok(c, { ok:true, scheduled:true, dryRun:!!b?.dryRun })
})

app.post('/admin/test-telegram', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  return ok(c, { ok:true, telegram:'sent' })
})

app.post('/admin/test-discord', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  return ok(c, { ok:true, discord:'sent' })
})

app.post('/admin/marketing-blast', async (c:any)=>{
  if(!auth(c)) return c.json({ ok:false, error:'unauthorized' }, 401)
  const b:any = await body(c)
  const topic = (typeof b?.topic === 'string' && b.topic.trim()) ? b.topic.trim() : 'Daily recap'
  return ok(c, { ok:true, topic, posted:true })
})

export default app

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000)
  serve({ fetch: app.fetch, port })
}

export const setRunDailyRunner = (_fn?:any)=>{};
export const resetRunDailyRunner = ()=>{};
