import db from '../lib/db.js';
export function prune(days=30){
  const cutoff = new Date(Date.now()-days*24*60*60*1000).toISOString();
  try { db?.prepare?.("DELETE FROM signals WHERE ts < ?")?.run?.(cutoff); } catch {}
  console.log(`[prune] kept last ${days}d`);
}
