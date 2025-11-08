import cron from 'node-cron';
import { CADENCE } from '../config/cadence';
import { runDailyOnce } from './runDaily';
import { flushPublishQueue } from './publishWorker';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch';
import { autoPromoteSignals } from '../services/marketing';
import { dispatchToDiscord } from '../posters/discord';

export function startSchedulers() {
  const tz = CADENCE.TIMEZONE || 'America/New_York';

  cron.schedule(
    '*/5 * * * *',
    () => flushPublishQueue().catch((err) => console.error('[scheduler] flushPublishQueue', err)),
    { timezone: tz },
  );

  // Stocks window – 09:35 local time
  cron.schedule(
    '35 9 * * *',
    () => runWindow(['stock']).catch((err) => console.error('[scheduler] stock window', err)),
    { timezone: tz },
  );

  // Crypto window – 13:00 local time
  cron.schedule(
    '0 13 * * *',
    () => runWindow(['crypto']).catch((err) => console.error('[scheduler] crypto window', err)),
    { timezone: tz },
  );

  const weeklyDow = toCronDow(CADENCE.WEEKLY_SUMMARY_DAY);
  cron.schedule(
    `0 17 * * ${weeklyDow}`,
    () => runWeekly().catch((err) => console.error('[scheduler] weekly digest', err)),
    { timezone: tz },
  );

  cron.schedule(
    '0 */6 * * *',
    () => runHealthCheck().catch((err) => console.error('[scheduler] health check', err)),
    { timezone: tz },
  );
}

async function runWindow(assets: Array<'stock' | 'crypto'>) {
  const result = await runDailyOnce({ assets });
  await autoPromoteSignals(result);
  if (result.postEnabled && !result.dryRun && result.messages.length) {
    await flushPublishQueue();
  }
}

export async function runWeekly() {
  const flags = resolveFlags();
  await dispatchWeeklyDigest(flags);
}

function resolveFlags() {
  const dryRun = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const postEnabled = (process.env.POST_ENABLED || 'true').toLowerCase() === 'true';
  return { dryRun, postEnabled };
}

function toCronDow(value: string | undefined) {
  const clean = (value || 'SUN').trim().toUpperCase();
  const map: Record<string, string> = {
    SUN: '0',
    MON: '1',
    TUE: '2',
    WED: '3',
    THU: '4',
    FRI: '5',
    SAT: '6',
  };
  return map[clean] ?? '0';
}

async function runHealthCheck() {
  const url = process.env.HEALTH_PING_URL ?? 'http://127.0.0.1:3000/status';
  const start = Date.now();
  try {
    const response = await fetch(url);
    const elapsed = Date.now() - start;
    const body = await response.json().catch(() => ({}));
    const status = response.ok ? 'OK' : `WARN ${response.status}`;
    const message = `Health ${status} in ${elapsed}ms — tz ${body?.cadence?.timezone ?? 'n/a'} at ${body?.time ?? new Date().toISOString()}`;
    await dispatchToDiscord({ tier: 'FREE', content: message });
  } catch (err) {
    const fallback = `[health] check failed: ${err instanceof Error ? err.message : String(err)}`;
    await dispatchToDiscord({ tier: 'FREE', content: fallback });
  }
}
