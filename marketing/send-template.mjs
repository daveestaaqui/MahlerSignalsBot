#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

function render(tpl, ctx) {
  return tpl.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) =>
    ctx[key] !== undefined ? String(ctx[key]) : ""
  );
}

async function main() {
  const [, , templateName, contextFile] = process.argv;
  if (!templateName) {
    console.error("Usage: node marketing/send-template.mjs <daily|weekly> [context.json]");
    process.exit(1);
  }

  const tplPath = path.resolve("marketing", "templates", `${templateName}.json`);
  const raw = await fs.readFile(tplPath, "utf-8");
  const tpl = JSON.parse(raw);

  let context = {};
  if (contextFile) {
    const ctxRaw = await fs.readFile(path.resolve(contextFile), "utf-8");
    context = JSON.parse(ctxRaw);
  }

  const payload = {
    title: render(tpl.title, context),
    body: render(tpl.body, context),
    cta: render(tpl.cta, context),
    disclaimer: tpl.disclaimer
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
