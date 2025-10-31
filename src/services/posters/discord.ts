import { request } from 'undici';

import { POSTING_ENV } from '../../config/posting.js';

type Tier = 'FREE' | 'PRO' | 'ELITE';

export type DiscordPostInput = {
  tier: Tier;
  content: string;
};

export type DiscordPostResult = {
  sent: boolean;
  skippedReason?: string;
  error?: string;
};

const webhookEnv: Record<Tier, string | undefined> = {
  FREE: process.env.DISCORD_WEBHOOK_URL_FREE,
  PRO: process.env.DISCORD_WEBHOOK_URL_PRO,
  ELITE: process.env.DISCORD_WEBHOOK_URL_ELITE,
};

export async function postToDiscord({ tier, content }: DiscordPostInput): Promise<DiscordPostResult> {
  const url = (webhookEnv[tier] ?? '').trim();
  const preview = content.slice(0, 160);
  const logMeta = { tier, preview };

  if (!url) {
    log('warn', 'discord_skip_missing_webhook', logMeta);
    return { sent: false, skippedReason: 'missing_webhook' };
  }

  if (!POSTING_ENV.POST_ENABLED) {
    log('info', 'discord_skip_post_disabled', logMeta);
    return { sent: false, skippedReason: 'post_disabled' };
  }

  if (POSTING_ENV.DRY_RUN) {
    log('info', 'discord_skip_dry_run', logMeta);
    return { sent: false, skippedReason: 'dry_run' };
  }

  try {
    await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: tier === 'ELITE' ? 'Aurora Elite' : tier === 'PRO' ? 'Aurora Signals' : 'Aurora Free',
      }),
    });
    log('info', 'discord_post_success', logMeta);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'discord_post_failed', { ...logMeta, error: message });
    return { sent: false, error: message };
  }
}

function log(level: 'info' | 'warn' | 'error', event: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, meta }));
}
