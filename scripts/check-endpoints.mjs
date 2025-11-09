#!/usr/bin/env node
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const adminToken = process.env.ADMIN_TOKEN || "";

const publicPaths = [
  "/",
  "/status",
  "/healthz",
  "/metrics",
  "/legal",
  "/blog",
  "/blog/hello-world",
];

const adminPaths = [
  "/admin/self-test",
  "/admin/post-now",
  "/admin/post-daily",
  "/admin/post-weekly",
  "/admin/test-telegram",
  "/admin/test-discord",
];

function request(method, url, body, includeAuth) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      method,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (includeAuth && adminToken) {
      options.headers.Authorization = `Bearer ${adminToken}`;
    }

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function checkSignalsEndpoint() {
  const path = "/signals/today";
  try {
    const { status, body } = await request("GET", base + path, null, false);
    if (status !== 200) {
      console.log(`- ${path} -> ${status}`);
      return;
    }
    let count = 0;
    try {
      const payload = JSON.parse(body);
      count = Array.isArray(payload && payload.signals)
        ? payload.signals.length
        : 0;
    } catch {
      count = 0;
    }
    console.log(`- ${path} -> ${status} (${count} signals)`);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.log(`- ${path} -> ERROR (${msg})`);
  }
}

async function main() {
  console.log(`Base URL: ${base}`);
  console.log("Public endpoints:");
  for (const p of publicPaths) {
    try {
      const { status } = await request("GET", base + p, null, false);
      console.log(`- ${p} -> ${status}`);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.log(`- ${p} -> ERROR (${msg})`);
    }
  }

  await checkSignalsEndpoint();

  console.log("\nAdmin endpoints:");
  for (const p of adminPaths) {
    try {
      const { status } = await request("GET", base + p, null, true);
      console.log(`- ${p} -> ${status}`);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.log(`- ${p} -> ERROR (${msg})`);
    }
  }
}

main().catch((err) => {
  console.error("Error in smoke test:", err);
  process.exit(1);
});
