#!/usr/bin/env node
import https from "node:https";

const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;

if (!apiKey || !serviceId) {
  console.error("Missing RENDER_API_KEY or RENDER_SERVICE_ID.");
  process.exit(1);
}

function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.render.com",
        path,
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` }
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
    req.end();
  });
}

async function main() {
  const { status, body } = await request(`/v1/services/${serviceId}/deploys`);
  console.log("HTTP status:", status);
  if (!Array.isArray(body)) {
    console.log("Response:", body);
    return;
  }
  console.log("Recent deploys:");
  for (const deploy of body.slice(0, 5)) {
    console.log(`- id=${deploy.id} status=${deploy.status} createdAt=${deploy.createdAt}`);
  }
}

main().catch(err => {
  console.error("Error fetching deploys:", err);
  process.exit(1);
});
