import http from 'node:http';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const path = process.argv[2] || '/';
const req = http.request({ host, port, path, method:'GET' }, res=>{
  let d=''; res.on('data', c=>d+=c); res.on('end', ()=>{ console.log(d); process.exit(0); });
});
req.on('error', err=>{ console.error('health fail', err.message); process.exit(2); });
req.end();
