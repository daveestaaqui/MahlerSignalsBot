import cron from 'node-cron';
import { runOnce } from './runCycle';

export function scheduleDailyPipelines(){
  // 13:00 UTC = 09:00 Eastern (ignoring DST adjustments handled via timezone option)
  cron.schedule('0 9 * * *', async ()=>{
    try {
      await runOnce();
    } catch (err) {
      console.error('[scheduler] daily run failed', err);
    }
  }, { timezone:'America/New_York' });
}
