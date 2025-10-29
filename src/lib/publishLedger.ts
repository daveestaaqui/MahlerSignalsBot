import db from './db.js';
import { todayIso } from '../config/cadence.js';

export type LedgerAsset = 'stock' | 'crypto' | 'weekly';

const selectCountsStmt = db.prepare(`
  SELECT asset_class, count
  FROM publish_ledger
  WHERE ledger_date = ?
`);

const selectSingleStmt = db.prepare(`
  SELECT count
  FROM publish_ledger
  WHERE ledger_date = ? AND asset_class = ?
`);

const upsertCountStmt = db.prepare(`
  INSERT INTO publish_ledger (ledger_date, asset_class, count, last_updated)
  VALUES (@ledger_date, @asset_class, @count, strftime('%s','now'))
  ON CONFLICT(ledger_date, asset_class) DO UPDATE SET
    count = excluded.count,
    last_updated = strftime('%s','now')
`);

export function getLedgerCounts(date = todayIso()): Record<LedgerAsset, number> {
  const rows = selectCountsStmt.all(date) as Array<{ asset_class: LedgerAsset; count: number }>;
  const result: Record<LedgerAsset, number> = { stock: 0, crypto: 0, weekly: 0 };
  for (const row of rows) {
    result[row.asset_class] = row.count ?? 0;
  }
  return result;
}

export function incrementLedger(asset: LedgerAsset, delta: number, date = todayIso()) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const current = getCount(asset, date);
  upsertCountStmt.run({
    ledger_date: date,
    asset_class: asset,
    count: Math.max(current + delta, 0),
  });
}

export function setLedgerCount(asset: LedgerAsset, count: number, date = todayIso()) {
  upsertCountStmt.run({
    ledger_date: date,
    asset_class: asset,
    count: Math.max(Math.floor(count), 0),
  });
}

export function getCount(asset: LedgerAsset, date = todayIso()): number {
  const row = selectSingleStmt.get(date, asset) as { count?: number } | undefined;
  return row?.count ?? 0;
}
