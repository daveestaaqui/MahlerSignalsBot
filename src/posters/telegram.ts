import { request } from 'undici';

export type TelegramTier = 'FREE' | 'PRO' | 'ELITE';

type TelegramPostArgs = {
  tier: TelegramTier;
  text: string;
};

export type TelegramPostResult = {
  sent?: true;
  skippedReason?: string;
  error?: string;
};

const chatIds: Record<TelegramTier, string | undefined> = {
  FREE: process.env.TELEGRAM_CHAT_ID_FREE,
  PRO: process.env.TELEGRAM_PRO_CHAT_ID,
  ELITE: process.env.TELEGRAM_ELITE_CHAT_ID,
};

export async function dispatchToTelegram({ tier, text }: TelegramPostArgs): Promise<TelegramPostResult> {
  const chatId = (chatIds[tier] ?? '').trim();
  const meta = { tier, preview: text.slice(0, 160) };
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    log('warn', 'telegram_skip_missing_token', meta);
    return { skippedReason: 'not_configured' };
  }

  if (!chatId) {
    log('warn', 'telegram_skip_missing_chat_id', meta);
    return { skippedReason: 'not_configured' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    log('info', 'telegram_post_success', meta);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'telegram_post_failed', { ...meta, error: message });
    return { error: message };
  }
}

function log(level: 'info' | 'warn' | 'error', event: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, meta }));
}
