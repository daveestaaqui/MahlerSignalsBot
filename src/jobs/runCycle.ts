import db from '../lib/db.js';
import { runStocksOnce } from '../pipeline/stocks/index.js';
import { runCryptoOnce } from '../pipeline/crypto/index.js';
import { STOCK_UNIVERSE, CRYPTO_UNIVERSE } from '../config/universe.js';
import { TIER_GATES } from '../config/tiers.js';
import { POSTING_RULES } from '../config/posting.js';
import { canPublish } from '../services/gating.js';
import { eliteStockMessage, eliteCryptoMessage, proMessage, freeTeaser } from '../services/formatters.js';
import type { SignalRecord } from '../signals/rules.js';

const insertSignalStmt = db.prepare(`
  INSERT INTO signals (symbol, asset_type, tier_min, score, reason, features, created_at, embargo_until, uniq_key)
  VALUES (@symbol, @asset_type, @tier_min, @score, @reason, @features, @created_at, @embargo_until, @uniq_key)
  ON CONFLICT(uniq_key) DO UPDATE SET
    score = excluded.score,
    reason = excluded.reason,
    features = excluded.features,
    created_at = excluded.created_at,
    embargo_until = excluded.embargo_until
`);

const selectSignalIdStmt = db.prepare(`SELECT id FROM signals WHERE uniq_key = ?`);
const queueStmt = db.prepare(`
  INSERT INTO publish_queue (signal_id, tier, payload, ready_at, sent_at, attempts, last_error)
  VALUES (@signal_id, @tier, @payload, @ready_at, NULL, 0, NULL)
  ON CONFLICT(signal_id, tier) DO UPDATE SET
    payload = excluded.payload,
    ready_at = excluded.ready_at,
    sent_at = NULL,
    attempts = 0,
    last_error = NULL
`);

export async function runOnce(){
  const stockSignals = await runStocksOnce(STOCK_UNIVERSE as string[]);
  const cryptoSignals = await runCryptoOnce(CRYPTO_UNIVERSE as string[]);
  const selected = selectSignals([...stockSignals, ...cryptoSignals]);
  for(const signal of selected){
    const id = upsertSignal(signal);
    enqueueForTiers(id, signal);
  }
}

function upsertSignal(signal: SignalRecord){
  insertSignalStmt.run({
    symbol: signal.symbol,
    asset_type: signal.asset_type,
    tier_min: signal.tier_min,
    score: signal.score,
    reason: signal.reason,
    features: JSON.stringify(signal.features ?? {}),
    created_at: signal.created_at,
    embargo_until: signal.embargo_until ?? null,
    uniq_key: signal.uniq_key,
  });
  const row = selectSignalIdStmt.get(signal.uniq_key) as { id:number };
  return row.id;
}

function enqueueForTiers(signalId:number, signal:SignalRecord){
  const now = Math.floor(Date.now()/1000);
  const freeReady = signal.embargo_until ?? (now + TIER_GATES.free.delaySeconds);
  const context = {
    asset: signal.asset_type,
    whale: Boolean(signal.features?.whales || signal.features?.whaleScore),
    congress: Boolean(signal.features?.congressScore),
    options: Boolean(signal.features?.optionsScore),
  } as const;
  const base = {
    symbol: signal.symbol,
    price: signal.features?.price,
    pct: signal.features?.pct_change_1d,
    rvol: signal.features?.rvol,
    reason: signal.reason,
    score: signal.score,
    subs: signal.features?.subs,
    assetType: signal.asset_type,
  };

  if(canPublish('elite', context)){
    const payload = signal.asset_type==='crypto' ? eliteCryptoMessage(base) : eliteStockMessage(base);
    queueStmt.run({ signal_id: signalId, tier:'elite', payload, ready_at: now });
  }
  if(canPublish('pro', context) && signal.score >= POSTING_RULES.MIN_SCORE_PRO){
    const payload = proMessage(base);
    queueStmt.run({ signal_id: signalId, tier:'pro', payload, ready_at: now });
  }
  if(canPublish('free', context)){
    const payload = freeTeaser(base);
    queueStmt.run({ signal_id: signalId, tier:'free', payload, ready_at: freeReady });
  }
}

function selectSignals(candidates: SignalRecord[]): SignalRecord[]{
  const now = Math.floor(Date.now()/1000);
  const start = new Date();
  start.setUTCHours(0,0,0,0);
  const startSec = Math.floor(start.getTime()/1000);

  const alreadySent = db.prepare(`
    SELECT COUNT(DISTINCT signal_id) as cnt
    FROM publish_queue
    WHERE sent_at IS NOT NULL AND sent_at >= ?
  `).get(startSec) as { cnt:number };
  const capRemaining = Math.max(POSTING_RULES.DAILY_POST_CAP - (alreadySent?.cnt || 0), 0);
  if(capRemaining <= 0) return [];

  const lastSentRows = db.prepare(`
    SELECT s.symbol, MAX(pq.sent_at) as last_ts
    FROM publish_queue pq
    JOIN signals s ON s.id = pq.signal_id
    WHERE pq.sent_at IS NOT NULL
    GROUP BY s.symbol
  `).all() as Array<{symbol:string; last_ts:number|null}>;
  const lastSentMap = new Map<string, number>();
  for(const row of lastSentRows){ if(row.last_ts) lastSentMap.set(row.symbol, row.last_ts); }
  const cooldownCutoff = now - POSTING_RULES.COOLDOWN_SECONDS;

  const filtered = candidates
    .filter(sig => sig.score >= POSTING_RULES.MIN_SCORE_PRO)
    .filter(sig => {
      const lastSent = lastSentMap.get(sig.symbol);
      return !(lastSent && lastSent >= cooldownCutoff);
    })
    .sort((a,b)=> b.score - a.score);

  const selected: SignalRecord[] = [];
  const used = new Set<string>();
  for(const sig of filtered){
    if(selected.length >= capRemaining) break;
    if(used.has(sig.symbol)) continue;
    selected.push(sig);
    used.add(sig.symbol);
  }
  if(selected.length < capRemaining){
    for(const sig of filtered){
      if(selected.length >= capRemaining) break;
      if(selected.includes(sig)) continue;
      selected.push(sig);
    }
  }
  return selected;
}
