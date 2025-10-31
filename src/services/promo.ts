import crypto from 'node:crypto';
import { request as undiciRequest } from 'undici';

import { POSTING_ENV } from '../config/posting.js';
import { seen } from '../lib/idempotency.js';

const X_ENDPOINT = 'https://api.x.com/2/tweets';

const fifteenMinutesMs = 15 * 60 * 1000;

type HttpClient = typeof undiciRequest;

let httpRequest: HttpClient = undiciRequest;

export function setPromoHttpClient(client: HttpClient) {
  httpRequest = client;
}

export function resetPromoHttpClient() {
  httpRequest = undiciRequest;
}

const toBool = (value: string | undefined) => value?.toLowerCase() === 'true';

export async function postToX(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const dryRun = toBool(env.DRY_RUN) || POSTING_ENV.DRY_RUN;
  const promoEnabled = toBool(env.PROMO_ENABLED) || POSTING_ENV.PROMO_ENABLED;
  const xEnabled = toBool(env.PROMO_X_ENABLED) || POSTING_ENV.PROMO_X_ENABLED;
  const token = env.X_BEARER_TOKEN ?? POSTING_ENV.X_BEARER_TOKEN ?? '';
  if (dryRun || !promoEnabled || !xEnabled) {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: 'missing_token' };
  }

  try {
    const res = await httpRequest(X_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    const data = (await res.body.json().catch(() => ({}))) as { data?: { id?: string }; error?: string; errors?: Array<{ message?: string }> };
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const errorMessage =
        data?.error ??
        (Array.isArray(data?.errors)
          ? data.errors
              .map((entry) => entry?.message)
              .filter((message): message is string => Boolean(message))
              .join('; ')
          : undefined) ??
        `x_status_${res.statusCode}`;
      return { ok: false, error: errorMessage };
    }
    const id = data?.data?.id;
    return typeof id === 'string' ? { ok: true, id } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function postToDiscord(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; error?: string }> {
  const dryRun = toBool(env.DRY_RUN) || POSTING_ENV.DRY_RUN;
  const promoEnabled = toBool(env.PROMO_ENABLED) || POSTING_ENV.PROMO_ENABLED;
  const discordEnabled =
    toBool(env.PROMO_DISCORD_ENABLED) || POSTING_ENV.PROMO_DISCORD_ENABLED;
  const webhook = env.DISCORD_WEBHOOK_URL ?? POSTING_ENV.DISCORD_WEBHOOK_URL ?? '';
  if (dryRun || !promoEnabled || !discordEnabled) {
    return { ok: true };
  }
  if (!webhook) {
    return { ok: false, error: 'missing_webhook' };
  }
  try {
    const res = await httpRequest(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
    });
    if (res.statusCode === 200 || res.statusCode === 204) {
      return { ok: true };
    }
    const errorText = await res.body.text();
    return { ok: false, error: errorText || `discord_status_${res.statusCode}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function promoteAll(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ x?: string; discord?: boolean }> {
  const dryRun = toBool(env.DRY_RUN) || POSTING_ENV.DRY_RUN;
  const promoEnabled = toBool(env.PROMO_ENABLED) || POSTING_ENV.PROMO_ENABLED;
  if (!promoEnabled) {
    return {};
  }
  const sanitized = sanitize(text);
  if (!sanitized) {
    return {};
  }
  const key = crypto.createHash('sha1').update(sanitized).digest('hex');
  if (seen(key, fifteenMinutesMs)) {
    return {};
  }

  const result: { x?: string; discord?: boolean } = {};

  if (dryRun) {
    return result;
  }

  const [xResult, discordResult] = await Promise.all([
    postToX(sanitized, env),
    postToDiscord(sanitized, env),
  ]);

  if (xResult.ok && xResult.id) {
    result.x = xResult.id;
  } else if (!xResult.ok && xResult.error) {
    logPromoError('x', xResult.error);
  }

  if (discordResult.ok) {
    result.discord = true;
  } else if (!discordResult.ok && discordResult.error) {
    logPromoError('discord', discordResult.error);
  }

  return result;
}

function sanitize(input: string): string {
  if (!input) return '';
  const withoutMarkdown = input.replace(/[_*`~>#]/g, '').replace(/\[(.*?)\]\((.*?)\)/g, '$1');
  const compressed = withoutMarkdown.replace(/\s+/g, ' ').trim();
  if (!compressed) return '';
  return compressed.length <= 250 ? compressed : `${compressed.slice(0, 247)}...`;
}

function logPromoError(provider: 'x' | 'discord', message: string) {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'promo_error',
      provider,
      message,
    }),
  );
}
