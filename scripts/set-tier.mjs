import http from 'node:http';

const [,, userId, tier='PRO'] = process.argv;
if (!userId) {
  console.error('Usage: node scripts/set-tier.mjs <userId> <FREE|PRO|ELITE>');
  process.exit(1);
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const payload = JSON.stringify({ userId, tier });

const req = http.request({
  host,
  port,
  path: '/webhook/subscription',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(body || 'ok');
  });
});

req.on('error', err => {
  console.error('fail', err.message);
  process.exit(2);
});

req.write(payload);
req.end();
