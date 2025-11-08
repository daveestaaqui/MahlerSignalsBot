#!/usr/bin/env node
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const base = process.env.BASE || 'http://127.0.0.1:3000';
const adminToken = process.env.ADMIN_TOKEN || "";

const publicPaths = ["/", "/status", "/healthz", "/metrics", "/legal"];
const adminPaths = [
  { path: "/admin/self-check", method: "GET", body: null },
  { path: "/admin/post-daily", method: "POST", body: { dryRun: true } },
  { path: "/admin/post-weekly", method: "POST", body: { dryRun: true } }
];

function request(method, urlString, body, includeAuth) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === "https:";
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
      }
    };
    if (includeAuth && adminToken) {
      options.headers["Authorization"] = `Bearer ${adminToken}`;
    }
    const mod = isHttps ? https : http;
    const req = mod.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data.slice(0, 512) });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("Base:", base);

  console.log("\nPublic endpoints:");
  for (const path of publicPaths) {
    try {
      const { status } = await request("GET", base + path, null, false);
      console.log(`- ${path} -> ${status}`);
    } catch (err) {
      console.log(`- ${path} -> ERROR (${err?.message || err})`);
    }
  }

  console.log("\nAdmin endpoints:");
  if (!adminToken) {
    console.log("ADMIN_TOKEN not set; expecting 401/403 responses.");
  }
  for (const { path, method, body } of adminPaths) {
    try {
      const { status } = await request(method, base + path, body, !!adminToken);
      console.log(`- ${method} ${path} -> ${status}`);
    } catch (err) {
      console.log(`- ${method} ${path} -> ERROR (${err?.message || err})`);
    }
  }
}

main().catch(err => {
  console.error("Error in smoke test:", err);
  process.exit(1);
});
