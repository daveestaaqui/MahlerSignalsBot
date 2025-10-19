import './web/server.js';
import { runOnce } from './jobs/runCycle.js';
console.log('Starting scheduler fallback…');
runOnce().catch(console.error);
const INTERVAL = Number(process.env.SCHEDULE_MS || (30*60*1000));
setInterval(()=> runOnce().catch(console.error), INTERVAL);
