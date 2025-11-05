import { Router, Request, Response, NextFunction } from "express";
import { log } from "../../lib/log";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 15_000;
const recentCalls = new Map<string, number>();

const guard = (req: Request, res: Response, next: NextFunction) => {
  const expectedToken = process.env.ADMIN_TOKEN ?? "";
  const expectedHeader = `Bearer ${expectedToken}`;
  if (req.headers.authorization !== expectedHeader) {
    log("warn", "admin unauthorized", { route: req.path });
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
};

const enforceRateLimit = (route: string, res: Response) => {
  const last = recentCalls.get(route) ?? 0;
  const now = Date.now();
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    log("warn", "admin rate limit hit", { route, retryAfter: 15 });
    res.status(429).json({ ok: false, retryAfter: 15 });
    return true;
  }
  recentCalls.set(route, now);
  return false;
};

const handlePost = (route: string) => (req: Request, res: Response) => {
  if (enforceRateLimit(route, res)) {
    return;
  }

  const envSnapshot = {
    TELEGRAM_CHANNEL_ID: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    DISCORD_CHANNEL_ID: Boolean(process.env.DISCORD_CHANNEL_ID),
    TELEGRAM_TOKEN: Boolean(process.env.TELEGRAM_TOKEN),
    DISCORD_TOKEN: Boolean(process.env.DISCORD_TOKEN),
  };
  log("info", "admin call", { route, envPresent: envSnapshot });
  // TODO: integrate messaging send for route using env credentials (no side-effects in handler yet).
  res.sendStatus(204);
};

router.use(guard);
router.post("/post-now", handlePost("/post-now"));
router.post("/post-daily", handlePost("/post-daily"));
router.post("/post-weekly", handlePost("/post-weekly"));
router.post("/test-telegram", handlePost("/test-telegram"));
router.post("/test-discord", handlePost("/test-discord"));

export default router;
