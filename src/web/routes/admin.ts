import { Router, type Request, type Response } from "express";
import { fetch } from "undici";
import { postDiscord, postTelegram } from "../../services/directPosters";
import { logError, logInfo, logWarn, type RequestWithId } from "../../lib/logger";
import { marketingBlast, postDaily, postNow } from "../jobs";

const router = Router();

type PosterConfig = {
  telegramToken?: string;
  telegramChats: Array<{ chatId: string; label: string }>;
  discordWebhook?: string;
};

const DRY_RUN_KEYS = ["dryRun", "dry_run"];

router.post("/post-now", async (req: RequestWithId, res: Response) => {
  await runAdminAction(
    req,
    "post-now",
    res,
    async () => {
      const dryRun = resolveDryRun(req, true);
      return await postNow({ dryRun });
    },
    (result) => respondWithMarketingResult(res, result),
  );
});

router.post("/post-daily", async (req: RequestWithId, res: Response) => {
  await runAdminAction(
    req,
    "post-daily",
    res,
    async () => {
      const dryRun = resolveDryRun(req, true);
      return await postDaily({ dryRun });
    },
    (result) => respondWithMarketingResult(res, result),
  );
});

router.post("/marketing-blast", async (req: RequestWithId, res: Response) => {
  const dryRun = resolveDryRun(req, true);
  const body = req.body as { topic?: unknown } | undefined;
  const topic = typeof body?.topic === "string" ? body.topic : undefined;
  await runAdminAction(
    req,
    "marketing-blast",
    res,
    async () => marketingBlast(topic, { dryRun }),
    (result) => {
      res.json({
        ok: true,
        dryRun: result.dryRun,
        template: result.template,
        topic,
        summary: result.summary,
        signals: result.signals,
        channels: result.channels,
      });
    },
  );
});

router.post("/test-telegram", async (req: RequestWithId, res: Response) => {
  await runAdminAction(req, "test-telegram", res, async () => {
    const config = resolvePosterConfig();
    const text = `ManySignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-telegram",
      skipDiscord: true,
    });
  });
});

router.post("/test-discord", async (req: RequestWithId, res: Response) => {
  await runAdminAction(req, "test-discord", res, async () => {
    const config = resolvePosterConfig();
    const text = `ManySignals test ✅ ${new Date().toISOString()}`;
    await dispatchSummary(text, config, {
      label: "test-discord",
      skipTelegram: true,
    });
  });
});

router.get("/test-all", async (req: RequestWithId, res: Response) => {
  await runAdminAction(
    req,
    "test-all",
    res,
    async () => runConnectivitySweep(),
    (summary) => res.json(summary),
  );
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

async function runAdminAction<T>(
  req: RequestWithId,
  action: string,
  res: Response,
  work: () => Promise<T>,
  onSuccess?: (result: T) => void,
): Promise<void> {
  try {
    const result = await work();
    if (onSuccess) {
      onSuccess(result);
      return;
    }
    if (Array.isArray(result)) {
      res.json({ ok: true, result });
      return;
    }
    if (result && typeof result === "object") {
      res.json({ ok: true, ...result });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    logError("admin.action_failed", {
      action,
      requestId: req.requestId,
      error: describeError(error),
    });
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}

type MarketingJobResult = Awaited<ReturnType<typeof postNow>>;

function respondWithMarketingResult(res: Response, result: MarketingJobResult) {
  res.json({
    ok: true,
    dryRun: result.dryRun,
    template: result.template,
    summary: result.summary,
    signals: result.signals,
    channels: result.channels,
  });
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
  const marketingPreview = await fetchMarketingPreviewSnapshot(baseUrl);
  const channels = summarizeMarketingChannels();

  return {
    ok: signals.ok && marketingPreview.ok,
    baseUrl,
    checks: {
      signalsToday: signals,
      marketingPreview,
      telegram: { configured: channels.telegram },
      discord: { configured: channels.discord },
      x: { configured: channels.x },
    },
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

function summarizeMarketingChannels() {
  const telegramChatId = (
    process.env.MARKETING_TELEGRAM_CHAT_ID ??
    process.env.TELEGRAM_CHAT_ID_FREE ??
    process.env.TELEGRAM_CHAT_ID_PRO ??
    process.env.TELEGRAM_CHAT_ID_ELITE ??
    ""
  ).trim();
  const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const discordWebhook = (
    process.env.MARKETING_DISCORD_WEBHOOK_URL ??
    process.env.DISCORD_WEBHOOK_URL ??
    process.env.DISCORD_WEBHOOK_URL_FREE ??
    process.env.DISCORD_WEBHOOK_URL_PRO ??
    process.env.DISCORD_WEBHOOK_URL_ELITE ??
    ""
  ).trim();
  const xToken = (process.env.X_ACCESS_TOKEN ?? process.env.X_BEARER_TOKEN ?? "").trim();
  return {
    telegram: Boolean(telegramToken && telegramChatId),
    discord: Boolean(discordWebhook),
    x: Boolean(xToken),
  };
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

function resolveDryRun(req: Request, fallback = true): boolean {
  const query = req.query as Record<string, unknown>;
  if (query && typeof query.dryRun !== "undefined") {
    return parseBooleanInput(query.dryRun, fallback);
  }

  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object") {
    for (const key of DRY_RUN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        return parseBooleanInput(body[key], fallback);
      }
    }
  }

  return fallback;
}

function parseBooleanInput(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
    return fallback;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

async function fetchMarketingPreviewSnapshot(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  const url = `${trimmed}/marketing/preview`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    const payload = (await res.json()) as { signals?: unknown[]; updatedAt?: string };
    const list = Array.isArray(payload?.signals) ? payload.signals : [];
    const updatedAt = typeof payload?.updatedAt === "string" ? payload.updatedAt : null;
    return { ok: true, count: list.length, updatedAt, url };
  } catch (error) {
    const message = describeError(error);
    logWarn("admin.test_all.marketing_preview_failed", { url, error: message });
    return { ok: false, count: 0, url, error: message };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unexpected admin error";
}
