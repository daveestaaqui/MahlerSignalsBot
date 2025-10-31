import { request } from 'undici';

import { POSTING_ENV } from '../config/posting.js';

export type DiscordTier = 'FREE' | 'PRO' | 'ELITE';

type DiscordPostArgs = {
  tier: DiscordTier;
  content: string;
};

type DiscordPostResult = {
  ok: boolean;
  tier: DiscordTier;
  delivered: boolean;
  skipped?: string;
  error?: string;
};

const webhookEnv: Record<DiscordTier, string | undefined> = {
  FREE: process.env.DISCORD_WEBHOOK_URL_FREE,
  PRO: process.env.DISCORD_WEBHOOK_URL_PRO,
  ELITE: process.env.DISCORD_WEBHOOK_URL_ELITE,
};

export async function postToDiscord({ tier, content }: DiscordPostArgs): Promise<DiscordPostResult> {
  const url = (webhookEnv[tier] ?? '').trim();
  const meta = { tier, preview: content.slice(0, 160) };

  if (!url) {
    log('warn', 'discord_skip_missing_webhook', meta);
    return { ok: false, tier, delivered: false, skipped: 'missing_webhook' };
  }

  if (!POSTING_ENV.POST_ENABLED) {
    log('info', 'discord_skip_post_disabled', meta);
    return { ok: true, tier, delivered: false, skipped: 'post_disabled' };
  }

  if (POSTING_ENV.DRY_RUN) {
    log('info', 'discord_skip_dry_run', meta);
    return { ok: true, tier, delivered: false, skipped: 'dry_run' };
  }

  try {
    await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: tier === 'ELITE' ? 'Aurora Elite' : tier === 'PRO' ? 'Aurora Pro' : 'Aurora Free',
      }),
    });
    log('info', 'discord_post_success', meta);
    return { ok: true, tier, delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'discord_post_failed', { ...meta, error: message });
    return { ok: false, tier, delivered: false, error: message };
  }
}

function log(level: 'info' | 'warn' | 'error', event: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, meta }));
}
