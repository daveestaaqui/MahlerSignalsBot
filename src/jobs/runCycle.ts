import { runDailyOnce } from './runDaily';

export type { DailyRunResult } from './runDaily';

export async function runOnce() {
  return runDailyOnce();
}

export { runDailyOnce };
