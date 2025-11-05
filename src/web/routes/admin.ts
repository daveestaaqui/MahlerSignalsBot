import type { Request, Response } from "express";
import { Router } from "express";

const r = Router();

function isDryRun(req: Request): boolean {
  try {
    if (typeof req.body === "object" && req.body) {
      if (typeof (req.body as any).dryRun === "boolean") {
        return !!(req.body as any).dryRun;
      }
    }
  } catch {
    // ignore parse errors
  }
  return false;
}

r.post("/post-now", (_req: Request, res: Response) => {
  return res.status(204).end();
});

r.post("/post-daily", (req: Request, res: Response) => {
  const _dryRun = isDryRun(req);
  return res.status(204).end();
});

r.post("/post-weekly", (req: Request, res: Response) => {
  const _dryRun = isDryRun(req);
  return res.status(204).end();
});

r.post("/test-telegram", (_req: Request, res: Response) => {
  return res.status(204).end();
});

r.post("/test-discord", (_req: Request, res: Response) => {
  return res.status(204).end();
});

r.get("/self-check", (_req: Request, res: Response) => {
  const must = (key: string) => (process.env[key] ? "ok" : "missing");
  const report = {
    ADMIN_TOKEN: must("ADMIN_TOKEN"),
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? "set" : "unset",
    TELEGRAM_BOT_TOKEN: must("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_PRO_CHAT_ID: must("TELEGRAM_PRO_CHAT_ID"),
    TELEGRAM_ELITE_CHAT_ID: must("TELEGRAM_ELITE_CHAT_ID"),
    DISCORD_WEBHOOK_URL: must("DISCORD_WEBHOOK_URL"),
  };
  return res.status(200).json({ ok: true, report });
});

export default r;
