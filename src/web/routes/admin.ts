import type { Request, Response } from "express";
import { Router } from "express";
import { fetch } from "undici";
import { buildDailySummary, buildNowSummary } from "../../services/analysis";
import { postDiscord, postTelegram, type PostResult } from "../../services/directPosters";
import { logError, logInfo, logWarn } from "../../lib/logger";

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
    const text = `ManySignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-telegram",
      skipDiscord: true,
    });
  });
});

router.post("/test-discord", async (_req: Request, res: Response) => {
  await runAdminAction("test-discord", res, async () => {
    const config = resolvePosterConfig();
    const text = `ManySignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-discord",
      skipTelegram: true,
    });
  });
});

router.get("/test-all", async (_req: Request, res: Response) => {
  await runAdminAction("test-all", res, async () => {
    const summary = await runConnectivitySweep();
    return { summary };
  });
});

router.get("/self-check", (_req: Request, res: Response) => {
  const must = (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return list.some((key) => process.env[key]) ? "ok" : "missing";
  };
  const report = {
    ADMIN_TOKEN: must("ADMIN_TOKEN"),
    TELEGRAM_BOT_TOKEN: must("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_FREE_CHAT_ID: must(["TELEGRAM_CHAT_ID_FREE", "TELEGRAM_FREE_CHAT_ID"]),
    TELEGRAM_PRO_CHAT_ID: must(["TELEGRAM_CHAT_ID_PRO", "TELEGRAM_PRO_CHAT_ID"]),
    TELEGRAM_ELITE_CHAT_ID: must(["TELEGRAM_CHAT_ID_ELITE", "TELEGRAM_ELITE_CHAT_ID"]),
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
  work: () => Promise<unknown>
): Promise<void> {
  try {
    const result = await work();
    if (result && typeof result === "object") {
      res.json({ ok: true, ...result });
    } else {
      res.json({ ok: true });
    }
  } catch (error) {
    logError("admin.action_failed", {
      action,
      error: describeError(error),
    });
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}

function resolvePosterConfig(): PosterConfig {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || undefined;
  const freeChatId = readEnvValue(["TELEGRAM_CHAT_ID_FREE", "TELEGRAM_FREE_CHAT_ID"]);
  const proChatId = readEnvValue(["TELEGRAM_CHAT_ID_PRO", "TELEGRAM_PRO_CHAT_ID"]);
  const eliteChatId = readEnvValue(["TELEGRAM_CHAT_ID_ELITE", "TELEGRAM_ELITE_CHAT_ID"]);
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL || undefined;

  const telegramChats = [
    { chatId: freeChatId, label: "telegram:free" },
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

  logInfo("admin.dispatch", {
    dryRun,
    skipTelegram,
    skipDiscord,
    label,
  });

  if (dryRun) {
    logInfo("admin.dispatch_dry_run", { summary, label });
    return;
  }

  const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

  if (!skipTelegram) {
    if (!config.telegramToken) {
      logWarn("admin.telegram_missing_token", { label });
    } else if (config.telegramChats.length === 0) {
      logWarn("admin.telegram_missing_chat_id", { label });
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
      logWarn("admin.discord_missing_webhook", { label });
    } else {
      const result = await postDiscord(config.discordWebhook, summary);
      results.push(result);
    }
  }

  const successes = results.filter((item) => item.ok).map((item) => item.channel);
  const failures = results
    .filter((item) => !item.ok)
    .map((item) => ({ channel: item.channel, error: item.error }));

  logInfo("admin.dispatch_complete", {
    label,
    successes,
    failures,
    attempted: results.length,
  });
}

async function runConnectivitySweep() {
  const baseUrl = resolveBaseUrl();
  const signals = await fetchSignalsSnapshot(baseUrl);
  const config = resolvePosterConfig();
  const timestamp = new Date().toISOString();
  const testMessage = `Test connectivity ok • ${timestamp}`;

  const discord = await dispatchDiscordHeartbeat(config.discordWebhook, testMessage);
  const telegram = await dispatchTelegramHeartbeats(config, testMessage);

  return {
    baseUrl,
    signals,
    discord,
    telegram,
  };
}

async function fetchSignalsSnapshot(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  const url = `${trimmed}/signals/today`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    const payload = (await res.json()) as unknown;
    let list: unknown[] = [];
    if (Array.isArray(payload)) {
      list = payload;
    } else if (
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { signals?: unknown[] }).signals)
    ) {
      list = (payload as { signals: unknown[] }).signals ?? [];
    }
    return { ok: true, count: list.length, url };
  } catch (error) {
    const message = describeError(error);
    logWarn("admin.test_all.signals_failed", { url, error: message });
    return { ok: false, count: 0, url, error: message };
  }
}

async function dispatchDiscordHeartbeat(webhook: string | undefined, message: string) {
  if (!webhook) {
    return { attempted: false, ok: false, error: "missing_webhook" };
  }
  const result = await postDiscord(webhook, message);
  return { attempted: true, ok: result.ok, error: result.error };
}

async function dispatchTelegramHeartbeats(config: PosterConfig, message: string) {
  if (!config.telegramToken) {
    return config.telegramChats.length
      ? config.telegramChats.map((chat) => ({
          chatId: chat.chatId,
          label: chat.label,
          attempted: false,
          ok: false,
          error: "missing_token",
        }))
      : [
          {
            chatId: "",
            label: "telegram",
            attempted: false,
            ok: false,
            error: "missing_token",
          },
        ];
  }
  if (!config.telegramChats.length) {
    return [
      {
        chatId: "",
        label: "telegram",
        attempted: false,
        ok: false,
        error: "missing_chat_ids",
      },
    ];
  }

  const results: Array<{ chatId: string; label: string; attempted: boolean; ok: boolean; error?: string }> = [];
  for (const chat of config.telegramChats) {
    const outcome = await safePostTelegram(config.telegramToken, chat.chatId, message, chat.label);
    results.push({
      chatId: chat.chatId,
      label: chat.label,
      attempted: true,
      ok: outcome.ok,
      error: outcome.error,
    });
  }
  return results;
}

async function safePostTelegram(
  token: string,
  chatId: string,
  message: string,
  label: string,
): Promise<PostResult> {
  try {
    return await postTelegram(token, chatId, message, label);
  } catch (error) {
    const description = describeError(error);
    logWarn("admin.test_all.telegram_failed", { chatId, label, error: description });
    return { ok: false, channel: label, error: description };
  }
}

function resolveBaseUrl(): string {
  const fromEnv =
    process.env.BASE_URL ||
    process.env.AURORA_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL;
  if (fromEnv) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  const port = Number(process.env.PORT || 3000);
  return `http://127.0.0.1:${port}`;
}

function readEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
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
