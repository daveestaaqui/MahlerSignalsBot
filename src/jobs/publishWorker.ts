import db from '../lib/db.js';
import { broadcast } from '../services/posters.js';

type Tier = 'free'|'pro'|'elite';

const selectQueue = db.prepare(`
  SELECT id, signal_id, tier, payload, attempts
  FROM publish_queue
  WHERE ready_at <= ? AND (sent_at IS NULL)
  ORDER BY ready_at ASC
  LIMIT ?
`);

const markSuccess = db.prepare(`UPDATE publish_queue SET sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?`);
const markFailure = db.prepare(`UPDATE publish_queue SET attempts = attempts + 1, last_error = ?, ready_at = ready_at + 300 WHERE id = ?`);

export async function flushPublishQueue(limit = 10) {
  const now = Math.floor(Date.now() / 1000);
  const rows = selectQueue.all(now, limit) as { id:number; tier:Tier; payload:string; attempts:number }[];
  for (const row of rows) {
    try {
      await broadcast(toTier(row.tier), row.payload);
      markSuccess.run(now, row.id);
    } catch (err:any) {
      markFailure.run(err?.message || String(err), row.id);
    }
  }
}

function toTier(tier: Tier) {
  return tier === 'free' ? 'FREE' : tier === 'pro' ? 'PRO' : 'ELITE';
}
