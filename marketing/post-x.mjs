#!/usr/bin/env node
import fs from "node:fs";

const bearer = process.env.X_BEARER_TOKEN;
const account = process.env.X_ACCOUNT_ID;

if (!bearer || !account) {
  console.log("X not configured, skipping.");
  process.exit(0);
}

const marketing = JSON.parse(fs.readFileSync("marketing.json", "utf-8"));
const parts = [marketing.title, marketing.body, marketing.disclaimer].filter(Boolean);
const text = parts.join("\n\n").slice(0, 270).trim();

const response = await fetch("https://api.twitter.com/2/tweets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearer}`,
  },
  body: JSON.stringify({ text }),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`X post failed (${response.status}): ${detail}`);
}

console.log("Posted to X successfully.");
