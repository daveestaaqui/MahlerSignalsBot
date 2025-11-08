import db from '../lib/db';
import { broadcast, type BroadcastSummary, type ProviderError } from '../services/posters';

type Tier = 'free'|'pro'|'elite';

const selectQueue = db.prepare(`
  SELECT pq.id, pq.signal_id, pq.tier, pq.payload, pq.attempts, s.features
  FROM publish_queue pq
  JOIN signals s ON s.id = pq.signal_id
  WHERE pq.ready_at <= ? AND pq.sent_at IS NULL
  ORDER BY pq.ready_at ASC
  LIMIT ?
`);

const markSuccess = db.prepare(`UPDATE publish_queue SET sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?`);
const markFailure = db.prepare(`UPDATE publish_queue SET attempts = attempts + 1, last_error = ?, ready_at = ready_at + 600 WHERE id = ?`);
const insertMetric = db.prepare(`INSERT INTO signal_metrics(signal_id, tier, entry_price, sent_at) VALUES(?,?,?,?) ON CONFLICT(signal_id, tier) DO UPDATE SET entry_price=excluded.entry_price, sent_at=excluded.sent_at`);

const MAX_ATTEMPTS = 3;

export type FlushSummary = {
  attempted: number;
  successes: number;
  posted: number;
  providerErrors: ProviderError[];
};

export async function flushPublishQueue(limit = 10): Promise<FlushSummary> {
  const now = Math.floor(Date.now() / 1000);
  const rows = selectQueue.all(now, limit) as { id:number; signal_id:number; tier:Tier; payload:string; attempts:number; features?:string }[];
  const summary: FlushSummary = {
    attempted: rows.length,
    successes: 0,
    posted: 0,
    providerErrors: [],
  };

  for (const row of rows) {
    try {
      const result = await broadcast(toTier(row.tier), row.payload);
      summary.successes += 1;
      summary.posted += result.posted;
      summary.providerErrors.push(...(result.providerErrors || []));
      markSuccess.run(now, row.id);
      const entryPrice = extractEntryPrice(row.features);
      insertMetric.run(row.signal_id, row.tier, entryPrice, now);
      log('info', 'publish_success', { queueId: row.id, signalId: row.signal_id, tier: row.tier });
    } catch (err:any) {
      if(row.attempts + 1 >= MAX_ATTEMPTS){
        log('error', 'publish_failure', { queueId: row.id, signalId: row.signal_id, tier: row.tier, error: String(err) });
        markFailure.run(String(err), row.id);
      }else{
        log('warn', 'publish_retry', { queueId: row.id, signalId: row.signal_id, tier: row.tier, attempts: row.attempts+1, error: String(err) });
        markFailure.run(String(err), row.id);
      }
    }
  }

  if (summary.providerErrors.length) {
    log('warn', 'publish_provider_errors', {
      total: summary.providerErrors.length,
      providers: Array.from(new Set(summary.providerErrors.map((err) => err.provider))),
    });
  }

  return summary;
}

function toTier(tier: Tier) {
  return tier === 'free' ? 'FREE' : tier === 'pro' ? 'PRO' : 'ELITE';
}

function extractEntryPrice(features?:string){
  if(!features) return null;
  try {
    const parsed = JSON.parse(features);
    return typeof parsed?.price === 'number' ? parsed.price : null;
  } catch {
    return null;
  }
}

function log(level:'info'|'warn'|'error', msg:string, meta?:Record<string, unknown>){
  const line = { ts: new Date().toISOString(), level, msg, meta };
  console.log(JSON.stringify(line));
}
