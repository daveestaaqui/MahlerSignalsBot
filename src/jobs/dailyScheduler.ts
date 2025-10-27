import cron from 'node-cron';
import { runOnce } from './runCycle.js';

export function scheduleDailyPipelines(){
  cron.schedule('0 9 * * *', async ()=>{
    try {
      await runOnce();
    } catch (err) {
      console.error('[scheduler] daily run failed', err);
    }
  }, { timezone: 'America/New_York' });
}
