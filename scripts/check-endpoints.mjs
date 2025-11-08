#!/usr/bin/env node
/**
 * scripts/check-endpoints.mjs
 *
 * Simple smoke test for Aurora-Signals endpoints.
 * Uses BASE env var (default http://localhost:3000).
 *
 * This system provides automated market analysis for informational purposes only
 * and does not constitute financial, investment, or trading advice.
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';

const BASE = process.env.BASE || 'http://localhost:3000';

const ENDPOINTS = [
  { path: '/',            expect: [200] },
  { path: '/status',      expect: [200] },
  { path: '/healthz',     expect: [200] },
  { path: '/metrics',     expect: [200] },
  { path: '/legal',       expect: [200] },
  { path: '/blog',        expect: [200] },
  { path: '/blog/hello-world', expect: [200] },
  { path: '/robots.txt',  expect: [200] },
  { path: '/sitemap.xml', expect: [200] },

  // Admin endpoints should be unauthorized without token
  { path: '/admin/self-check',    expect: [401, 403] },
  { path: '/admin/post-now',      expect: [401, 403] },
  { path: '/admin/post-daily',    expect: [401, 403] },
  { path: '/admin/post-weekly',   expect: [401, 403] },
  { path: '/admin/test-telegram', expect: [401, 403] },
  { path: '/admin/test-discord',  expect: [401, 403] }
];

function request(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method: 'GET', timeout: 8000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', (err) => {
      resolve({ status: 0, body: String(err) });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    req.end();
  });
}

async function main() {
  console.log(`Checking endpoints against BASE=${BASE}`);
  let failures = 0;

  for (const ep of ENDPOINTS) {
    const url = `${BASE}${ep.path}`;
    try {
      const { status, body } = await request(url);
      const ok = ep.expect.includes(status);
      const statusLabel = ok ? 'OK' : 'FAIL';
      console.log(
        `[${statusLabel}] ${status} ${ep.path} (expected ${ep.expect.join(
          '/'
        )})`
      );

      if (!ok) {
        failures++;
        const snippet = (body || '').slice(0, 200).replace(/\s+/g, ' ');
        console.log(`  Body: ${snippet}`);
      }
    } catch (err) {
      failures++;
      console.log(`[ERROR] ${ep.path}: ${err}`);
    }
  }

  if (failures > 0) {
    console.error(`Smoke test finished with ${failures} failing endpoint(s).`);
    process.exitCode = 1;
  } else {
    console.log('All endpoints matched expected status codes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
