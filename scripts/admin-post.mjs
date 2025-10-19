import http from 'node:http';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const req = http.request({ host, port, path:'/admin/post', method:'POST' }, res=>{
  res.on('data',()=>{}); res.on('end', ()=>console.log('ok'));
});
req.on('error', e=>{ console.error('fail', e.message); process.exit(2); });
req.end();
