import { runOnce } from '../dist/jobs/runCycle.js';
const days = Number(process.argv[2]||"2");
await runOnce().catch(()=>{});
try {
  const { default: db } = await import('../dist/lib/db.js');
  const iso = new Date(Date.now()-days*24*60*60*1000).toISOString();
  db?.prepare?.("UPDATE signals SET ts = ? WHERE tier='PRO' OR tier='ELITE'")?.run?.(iso);
  console.log('seed:OK (shifted timestamps older to showcase FREE delay)');
} catch { console.log('seed:WARN'); }
