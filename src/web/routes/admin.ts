import type { Request, Response } from "express";
import { Router } from "express";
import { buildDailySummary, buildNowSummary } from "../../services/analysis";
import { postDiscord, postTelegram } from "../../services/directPosters";
import { log } from "../../lib/log";

const router = Router();

type PosterConfig = {
  telegramToken?: string;
  telegramChats: Array<{ chatId: string; label: string }>;
  discordWebhook?: string;
};

const DRY_RUN_KEYS = ["dryRun", "dry_run"];

router.post("/post-now", async (_req: Request, res: Response) => {
  await runAdminAction("post-now", res, async () => {
    const config = resolvePosterConfig();
    const summary = await buildNowSummary();
    await dispatchSummary(summary, config, { label: "now" });
  });
});

router.post("/post-daily", async (req: Request, res: Response) => {
  await runAdminAction("post-daily", res, async () => {
    await handleScheduled(req, "24h");
  });
});

router.post("/post-weekly", async (req: Request, res: Response) => {
  await runAdminAction("post-weekly", res, async () => {
    await handleScheduled(req, "7d");
  });
});

router.post("/test-telegram", async (_req: Request, res: Response) => {
  await runAdminAction("test-telegram", res, async () => {
    const config = resolvePosterConfig();
    const text = `AuroraSignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-telegram",
      skipDiscord: true,
    });
  });
});

router.post("/test-discord", async (_req: Request, res: Response) => {
  await runAdminAction("test-discord", res, async () => {
    const config = resolvePosterConfig();
    const text = `AuroraSignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-discord",
      skipTelegram: true,
    });
  });
});

router.get("/self-check", (_req: Request, res: Response) => {
  const must = (key: string) => (process.env[key] ? "ok" : "missing");
  const report = {
    ADMIN_TOKEN: must("ADMIN_TOKEN"),
    TELEGRAM_BOT_TOKEN: must("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_PRO_CHAT_ID: must("TELEGRAM_PRO_CHAT_ID"),
    TELEGRAM_ELITE_CHAT_ID: must("TELEGRAM_ELITE_CHAT_ID"),
    DISCORD_WEBHOOK_URL: must("DISCORD_WEBHOOK_URL"),
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? "set" : "unset",
  };
  res.json({ ok: true, report });
});

export default router;

async function handleScheduled(
  req: Request,
  window: "24h" | "7d"
) {
  const dryRun = getDryRun(req);
  const config = resolvePosterConfig();
  const summary = await buildDailySummary(window);

  await dispatchSummary(summary, config, {
    dryRun,
    label: window,
  });
}

async function runAdminAction(
  action: string,
  res: Response,
  work: () => Promise<void>
): Promise<void> {
  try {
    await work();
  } catch (error) {
    log("warn", `admin ${action} failed`, { error: describeError(error) });
  } finally {
    res.status(204).end();
  }
}

function resolvePosterConfig(): PosterConfig {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || undefined;
  const proChatId = process.env.TELEGRAM_PRO_CHAT_ID || "";
  const eliteChatId = process.env.TELEGRAM_ELITE_CHAT_ID || "";
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL || undefined;

  const telegramChats = [
    { chatId: proChatId, label: "telegram:pro" },
    { chatId: eliteChatId, label: "telegram:elite" },
  ].filter((entry) => entry.chatId);

  return { telegramToken, telegramChats, discordWebhook };
}

type DispatchOptions = {
  dryRun?: boolean;
  skipTelegram?: boolean;
  skipDiscord?: boolean;
  label?: string;
};

async function dispatchSummary(
  summary: string,
  config: PosterConfig,
  options: DispatchOptions
) {
  const { dryRun = false, skipTelegram = false, skipDiscord = false } =
    options || {};
  const label = options?.label ?? "now";

  log("info", "admin dispatch", {
    dryRun,
    skipTelegram,
    skipDiscord,
    label,
  });

  if (dryRun) {
    log("info", "admin dispatch (dry-run)", { summary, label });
    return;
  }

  const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

  if (!skipTelegram) {
    if (!config.telegramToken) {
      log("warn", "telegram missing bot token", { label });
    } else if (config.telegramChats.length === 0) {
      log("warn", "telegram missing chat ids", { label });
    } else {
      for (const chat of config.telegramChats) {
        const result = await postTelegram(
          config.telegramToken,
          chat.chatId,
          summary,
          chat.label
        );
        results.push(result);
      }
    }
  }

  if (!skipDiscord) {
    if (!config.discordWebhook) {
      log("warn", "discord missing webhook", { label });
    } else {
      const result = await postDiscord(config.discordWebhook, summary);
      results.push(result);
    }
  }

  const successes = results.filter((item) => item.ok).map((item) => item.channel);
  const failures = results
    .filter((item) => !item.ok)
    .map((item) => ({ channel: item.channel, error: item.error }));

  log("info", "admin dispatch complete", {
    label,
    successes,
    failures,
    attempted: results.length,
  });
}

function getDryRun(req: Request): boolean {
  const body = req.body;
  if (!body) {
    return false;
  }

  if (typeof body === "boolean") {
    return body;
  }

  if (typeof body === "object") {
    for (const key of DRY_RUN_KEYS) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
    }
  }

  return false;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unexpected admin error";
}
