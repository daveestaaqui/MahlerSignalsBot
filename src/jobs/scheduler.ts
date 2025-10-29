import cron from 'node-cron';
import { CADENCE } from '../config/cadence.js';
import { runDailyOnce } from './runDaily.js';
import { flushPublishQueue } from './publishWorker.js';
import { dispatchWeeklyDigest } from '../services/weeklyDispatch.js';

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
}

async function runWindow(assets: Array<'stock' | 'crypto'>) {
  const result = await runDailyOnce({ assets });
  if (result.postEnabled && !result.dryRun && result.messages.length) {
    await flushPublishQueue();
  }
}

async function runWeekly() {
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
