#!/usr/bin/env node
import https from "node:https";

const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;

if (!apiKey || !serviceId) {
  console.error("Missing RENDER_API_KEY or RENDER_SERVICE_ID in environment.");
  process.exit(1);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.render.com",
        path,
        method,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
        }
      },
      res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : {} });
          } catch {
            resolve({ status: res.statusCode || 0, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("Triggering Render deploy...");
  const start = await request("POST", `/v1/services/${serviceId}/deploys`, {});
  console.log("Deploy trigger status:", start.status);
  if (!start.status || start.status >= 400) {
    console.error("Failed to trigger deploy:", start.body);
    process.exit(1);
  }
  const deployId = start.body?.id;
  if (!deployId) {
    console.error("Render response missing deploy id.");
    process.exit(1);
  }
  console.log("Deploy ID:", deployId);
  const t0 = Date.now();
  while (true) {
    const { status, body } = await request("GET", `/v1/services/${serviceId}/deploys/${deployId}`);
    const phase = body?.status || "unknown";
    console.log(`Deploy status: HTTP ${status}, phase=${phase}`);
    if (["live", "deployed", "succeeded"].includes(phase)) {
      console.log("✅ Deploy completed successfully.");
      break;
    }
    if (["failed", "canceled", "cancelling"].includes(phase)) {
      console.error("❌ Deploy failed:", body);
      process.exit(1);
    }
    if (Date.now() - t0 > 20 * 60 * 1000) {
      console.error("❌ Deploy polling timed out (20m).");
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 15000));
  }
}

main().catch(err => {
  console.error("Unexpected deploy error:", err);
  process.exit(1);
});
