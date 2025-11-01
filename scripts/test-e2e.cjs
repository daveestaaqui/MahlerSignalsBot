const { spawn } = require('child_process')

const BASE = (process.env.BASE||'').replace(/\/$/,'')
const ADMIN_TOKEN = process.env.ADMIN_TOKEN||''

if(!BASE){ console.error('BASE not set'); process.exit(2) }

const routes = [
  ['GET', '/status'],
  ['GET', '/healthz'],
  ['GET', '/preview/daily'],
  ['GET', '/api/preview/daily'],
  ['POST','/admin/post-now'],
  ['POST','/admin/post-daily'],
  ['POST','/admin/post-weekly'],
  ['POST','/admin/test-telegram'],
  ['POST','/admin/test-discord'],
]

function run(method, path, body){
  return new Promise((resolve)=>{
    const args = ['-sS','-o','/dev/null','-w','%{http_code} %{time_starttransfer} ms\n','-X',method, BASE+path]
    const h = ['-H',`Authorization: Bearer ${ADMIN_TOKEN}`,'-H','Content-Type: application/json']
    const d = body ? ['--data-binary', body] : []
    const p = spawn('/usr/bin/curl',[...args, ...(path.startsWith('/admin/')? h:[]), ...d])
    let out=''; p.stdout.on('data',b=>out+=b)
    p.on('close',()=>{ process.stdout.write(`${method} ${path} | ${out}`); resolve() })
  })
}

;(async()=>{
  for(const [m,p] of routes){
    const body = p.startsWith('/admin/') ? '{}' : ''
    await run(m,p,body)
  }
})()
