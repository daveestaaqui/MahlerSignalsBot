import { fetch } from "undici";
import { log } from "../lib/log.js";

export type PostResult = {
  ok: boolean;
  channel: string;
  error?: string;
};

export async function postTelegram(
  token: string,
  chatId: string,
  text: string,
  label?: string
): Promise<PostResult> {
  const channel = label ?? `telegram:${chatId}`;

  if (!token) {
    const error = "missing_token";
    log("warn", "telegram dispatch skipped", { channel, error });
    return { ok: false, channel, error };
  }

  if (!chatId) {
    const error = "missing_chat_id";
    log("warn", "telegram dispatch skipped", { channel, error });
    return { ok: false, channel, error };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await safeRead(response);
      const error = `http_${response.status}`;
      log("warn", "telegram dispatch failed", { channel, error, errorBody });
      return { ok: false, channel, error };
    }

    log("info", "telegram dispatch sent", { channel });
    return { ok: true, channel };
  } catch (error) {
    const message = describeError(error);
    log("warn", "telegram dispatch error", { channel, error: message });
    return { ok: false, channel, error: message };
  }
}

export async function postDiscord(
  webhookUrl: string,
  text: string
): Promise<PostResult> {
  const channel = "discord:webhook";

  if (!webhookUrl) {
    const error = "missing_webhook";
    log("warn", "discord dispatch skipped", { error });
    return { ok: false, channel, error };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });

    if (!response.ok) {
      const errorBody = await safeRead(response);
      const error = `http_${response.status}`;
      log("warn", "discord dispatch failed", { channel, error, errorBody });
      return { ok: false, channel, error };
    }

    log("info", "discord dispatch sent", { channel });
    return { ok: true, channel };
  } catch (error) {
    const message = describeError(error);
    log("warn", "discord dispatch error", { channel, error: message });
    return { ok: false, channel, error: message };
  }
}

async function safeRead(response: ResponseLike): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable>";
  }
}

type ResponseLike = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown_error";
}
