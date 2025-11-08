#!/usr/bin/env node
/**
 * scripts/check-endpoints.mjs
 *
 * Simple smoke test for Aurora-Signals endpoints.
 * Usage:
 *   BASE=http://localhost:3000 node scripts/check-endpoints.mjs
 *   BASE=https://aurora-signals.onrender.com node scripts/check-endpoints.mjs
 */

import { execSync } from 'child_process';

const BASE = process.env.BASE || 'http://localhost:3000';

const endpoints = [
  '/',
  '/status',
  '/healthz',
  '/metrics',
  '/legal',
  '/blog',
  '/blog/hello-world',
  '/robots.txt',
  '/sitemap.xml'
];

function check(url) {
  try {
    const code = execSync(`curl -s -o /dev/null -w "%{http_code}" "${url}"`, {
      stdio: ['ignore', 'pipe', 'pipe']
    }).toString().trim();
    console.log(`${code} ${url}`);
  } catch (err) {
    console.error(`ERR ${url}:`, err.message);
  }
}

console.log(`Checking endpoints against BASE=${BASE}`);
for (const path of endpoints) {
  const url = `${BASE}${path}`;
  check(url);
}
