import 'dotenv/config';
import cron from 'node-cron';
import './web/server.js';
import { runOnce } from './jobs/runCycle.js';
import { flushPublishQueue } from './jobs/publishWorker.js';
import { scheduleDailyPipelines } from './jobs/dailyScheduler.js';

console.log('Starting scheduler…');
// Run at startup + every 30 minutes
runOnce().catch(e=>console.error(e));
flushPublishQueue().catch(e=>console.error(e));
cron.schedule('*/30 * * * *', ()=> runOnce().catch(e=>console.error(e)));
cron.schedule('*/5 * * * *', ()=> flushPublishQueue().catch(e=>console.error(e)));
scheduleDailyPipelines();
