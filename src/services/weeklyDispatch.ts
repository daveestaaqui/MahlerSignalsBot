import { buildWeeklyDigest } from './weeklyDigest.js';
import { broadcast } from './posters.js';
import { incrementLedger } from '../lib/publishLedger.js';
import { todayIso } from '../config/cadence.js';

type Flags = {
  dryRun: boolean;
  postEnabled: boolean;
};

export async function dispatchWeeklyDigest(flags: Flags) {
  const digest = buildWeeklyDigest();
  if (flags.postEnabled && !flags.dryRun && digest.summary.count > 0) {
    await Promise.allSettled([
      broadcast('PRO', digest.message),
      broadcast('ELITE', digest.message),
    ]);
    incrementLedger('weekly', 1, todayIso());
  }
  return digest;
}
