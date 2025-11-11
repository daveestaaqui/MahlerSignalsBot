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
      return false;
    }
    const payload = JSON.parse(body);
    const signals = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.signals)
      ? payload.signals
      : [];
    const isValid =
      signals.length >= 3 &&
      signals.every(
        (signal) =>
          isNonEmpty(signal.symbol) &&
          isNonEmpty(signal.timeframe) &&
          hasExpectedMove(signal) &&
          hasRationale(signal) &&
          isNonEmpty(signal?.riskNote) &&
          hasDisclaimer(signal) &&
          hasDataSources(signal),
      );
    const result = isValid
      ? `(${signals.length} signals validated)`
      : `(${signals.length} signals, validation failed)`;
    console.log(`- ${path} -> ${status} ${result}`);
    return isValid;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.log(`- ${path} -> ERROR (${msg})`);
    return false;
  }
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExpectedMove(signal) {
  return isNonEmpty(signal?.expectedMove);
}

function hasRationale(signal) {
  const block = signal?.rationale;
  if (!block || typeof block !== "object") return false;
  return isNonEmpty(block.technical) || isNonEmpty(block.fundamental);
}

function hasDisclaimer(signal) {
  return isNonEmpty(signal?.disclaimer);
}

function hasDataSources(signal) {
  return Array.isArray(signal?.dataSources) && signal.dataSources.length > 0;
}

async function main() {
  let hasFailures = false;
  console.log(`Base URL: ${base}`);
  console.log("Public endpoints:");
  for (const p of publicPaths) {
    try {
      const { status } = await request("GET", base + p, null, false);
      console.log(`- ${p} -> ${status}`);
      if (p === "/status" && status !== 200) {
        hasFailures = true;
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.log(`- ${p} -> ERROR (${msg})`);
      if (p === "/status") {
        hasFailures = true;
      }
    }
  }

  const signalsHealthy = await checkSignalsEndpoint();
  if (!signalsHealthy) {
    hasFailures = true;
  }

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

  if (hasFailures) {
    console.error("Critical endpoint checks failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error in smoke test:", err);
  process.exit(1);
});
