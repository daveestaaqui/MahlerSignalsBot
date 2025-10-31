type RunResult = { changes: number; lastInsertRowid?: number };

const SQL_INSERT_USER = normalizeSql(
  "INSERT INTO users (id, tier) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tier=excluded.tier",
);
const SQL_SELECT_USER_TIER = normalizeSql("SELECT tier FROM users WHERE id=?");
const SQL_SELECT_SNAPSHOT = normalizeSql(
  "SELECT payload, fetched_at, ttl_seconds FROM data_snapshots WHERE source = ? AND asset = '*'",
);
const SQL_UPSERT_SNAPSHOT = normalizeSql(
  "INSERT INTO data_snapshots (source, asset, fetched_at, payload, ttl_seconds) VALUES (?, '*', ?, ?, ?) ON CONFLICT(source, asset) DO UPDATE SET fetched_at = excluded.fetched_at, payload = excluded.payload, ttl_seconds = excluded.ttl_seconds",
);
const SQL_INSERT_SIGNAL = normalizeSql(
  "INSERT INTO signals (symbol, asset_type, tier_min, score, reason, features, created_at, embargo_until, uniq_key) VALUES (@symbol, @asset_type, @tier_min, @score, @reason, @features, @created_at, @embargo_until, @uniq_key) ON CONFLICT(uniq_key) DO UPDATE SET score = excluded.score, reason = excluded.reason, features = excluded.features, created_at = excluded.created_at, embargo_until = excluded.embargo_until",
);
const SQL_SELECT_SIGNAL_ID = normalizeSql("SELECT id FROM signals WHERE uniq_key = ?");
const SQL_INSERT_QUEUE = normalizeSql(
  "INSERT INTO publish_queue (signal_id, tier, payload, ready_at, sent_at, attempts, last_error) VALUES (@signal_id, @tier, @payload, @ready_at, NULL, 0, NULL) ON CONFLICT(signal_id, tier) DO UPDATE SET payload = excluded.payload, ready_at = excluded.ready_at, sent_at = NULL, attempts = 0, last_error = NULL",
);
const SQL_SELECT_QUEUE_READY = normalizeSql(
  "SELECT pq.id, pq.signal_id, pq.tier, pq.payload, pq.attempts, s.features FROM publish_queue pq JOIN signals s ON s.id = pq.signal_id WHERE pq.ready_at <= ? AND pq.sent_at IS NULL ORDER BY pq.ready_at ASC LIMIT ?",
);
const SQL_MARK_SUCCESS = normalizeSql(
  "UPDATE publish_queue SET sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?",
);
const SQL_MARK_FAILURE = normalizeSql(
  "UPDATE publish_queue SET attempts = attempts + 1, last_error = ?, ready_at = ready_at + 600 WHERE id = ?",
);
const SQL_UPSERT_METRIC = normalizeSql(
  "INSERT INTO signal_metrics(signal_id, tier, entry_price, sent_at) VALUES(?,?,?,?) ON CONFLICT(signal_id, tier) DO UPDATE SET entry_price=excluded.entry_price, sent_at=excluded.sent_at",
);
const SQL_WEEKLY_SUMMARY = normalizeSql(
  "SELECT pq.tier, pq.sent_at, s.symbol, s.score, s.features, m.entry_price, m.exit_price_1d, m.exit_price_3d FROM publish_queue pq JOIN signals s ON s.id = pq.signal_id LEFT JOIN signal_metrics m ON m.signal_id = pq.signal_id AND m.tier = pq.tier WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ?",
);
const SQL_LAST_SENT = normalizeSql(
  "SELECT s.symbol, s.asset_type, MAX(pq.sent_at) as last_sent FROM publish_queue pq JOIN signals s ON s.id = pq.signal_id WHERE pq.sent_at IS NOT NULL GROUP BY s.symbol, s.asset_type",
);
const SQL_POSTED_TODAY = normalizeSql(
  "SELECT s.asset_type, COUNT(DISTINCT pq.signal_id) as cnt FROM publish_queue pq JOIN signals s ON s.id = pq.signal_id WHERE pq.sent_at IS NOT NULL AND pq.sent_at >= ? GROUP BY s.asset_type",
);
const SQL_SELECT_LEDGER_COUNTS = normalizeSql(
  "SELECT asset_class, count FROM publish_ledger WHERE ledger_date = ?",
);
const SQL_SELECT_LEDGER_SINGLE = normalizeSql(
  "SELECT count FROM publish_ledger WHERE ledger_date = ? AND asset_class = ?",
);
const SQL_UPSERT_LEDGER = normalizeSql(
  "INSERT INTO publish_ledger (ledger_date, asset_class, count, last_updated) VALUES (@ledger_date, @asset_class, @count, strftime('%s','now')) ON CONFLICT(ledger_date, asset_class) DO UPDATE SET count = excluded.count, last_updated = strftime('%s','now')",
);
const SQL_SELECT_LOCK = normalizeSql("SELECT expires_at FROM locks WHERE name = ?");
const SQL_UPSERT_LOCK = normalizeSql(
  "INSERT INTO locks(name, expires_at) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET expires_at = excluded.expires_at",
);
const SQL_DELETE_LOCK = normalizeSql("DELETE FROM locks WHERE name = ?");

type UserRow = { id: string; tier: string; created_at: number };
type SignalRow = {
  id: number;
  symbol: string;
  asset_type: 'stock' | 'crypto';
  tier_min: string;
  score: number;
  reason: string;
  features?: string | null;
  created_at: number;
  embargo_until: number | null;
  uniq_key: string;
};
type PublishQueueRow = {
  id: number;
  signal_id: number;
  tier: string;
  payload: string;
  ready_at: number;
  sent_at: number | null;
  attempts: number;
  last_error: string | null;
};
type SnapshotRow = { payload: string; fetched_at: string; ttl_seconds?: number };
type LockRow = { expires_at: number };
type SignalMetricRow = {
  signal_id: number;
  tier: string;
  entry_price: number | null;
  sent_at: number | null;
  exit_price_1d?: number | null;
  exit_price_3d?: number | null;
  pnl_1d?: number | null;
  pnl_3d?: number | null;
};
type LedgerRow = { ledger_date: string; asset_class: string; count: number; last_updated: number };

class MemoryStatement {
  constructor(private db: MemoryDB, private sql: string) {}

  run(...args: any[]): RunResult {
    return this.db.executeRun(this.sql, args);
  }

  get(...args: any[]): any {
    return this.db.executeGet(this.sql, args);
  }

  all(...args: any[]): any[] {
    return this.db.executeAll(this.sql, args);
  }
}

class MemoryDB {
  private users = new Map<string, UserRow>();
  private signals = new Map<number, SignalRow>();
  private signalByUniq = new Map<string, number>();
  private publishQueue = new Map<number, PublishQueueRow>();
  private publishQueueByKey = new Map<string, number>();
  private dataSnapshots = new Map<string, SnapshotRow>();
  private locks = new Map<string, LockRow>();
  private signalMetrics = new Map<string, SignalMetricRow>();
  private publishLedger = new Map<string, LedgerRow>();
  private nextSignalId = 1;
  private nextQueueId = 1;
  private unhandled = new Set<string>();

  prepare(sql: string) {
    return new MemoryStatement(this, normalizeSql(sql));
  }

  pragma(_: string) {
    return [];
  }

  exec(_: string) {
    return this;
  }

  private nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  executeRun(sql: string, args: any[]): RunResult {
    switch (sql) {
      case SQL_INSERT_USER: {
        const [id, tier] = args;
        if (!id) return { changes: 0 };
        const existing = this.users.get(String(id));
        const created = existing?.created_at ?? this.nowSec();
        this.users.set(String(id), { id: String(id), tier: String(tier ?? 'FREE'), created_at: created });
        return { changes: 1 };
      }
      case SQL_UPSERT_SNAPSHOT: {
        const [source, fetchedAt, payload, ttl] = args;
        if (!source) return { changes: 0 };
        this.dataSnapshots.set(String(source), {
          payload: typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
          fetched_at: String(fetchedAt ?? new Date().toISOString()),
          ttl_seconds: Number.isFinite(Number(ttl)) ? Number(ttl) : undefined,
        });
        return { changes: 1 };
      }
      case SQL_INSERT_SIGNAL: {
        const params = toObject(args[0]);
        if (!params || !params.uniq_key) return { changes: 0 };
        let id = this.signalByUniq.get(params.uniq_key);
        if (!id) {
          id = this.nextSignalId++;
          this.signalByUniq.set(params.uniq_key, id);
        }
        const row: SignalRow = {
          id,
          symbol: String(params.symbol ?? ''),
          asset_type: (params.asset_type ?? 'stock') as 'stock' | 'crypto',
          tier_min: String(params.tier_min ?? 'pro'),
          score: numberOrZero(params.score),
          reason: String(params.reason ?? ''),
          features: typeof params.features === 'string' ? params.features : params.features ? JSON.stringify(params.features) : null,
          created_at: numberOrZero(params.created_at ?? this.nowSec()),
          embargo_until: params.embargo_until === null || params.embargo_until === undefined ? null : numberOrZero(params.embargo_until),
          uniq_key: String(params.uniq_key),
        };
        this.signals.set(id, row);
        return { changes: 1, lastInsertRowid: id };
      }
      case SQL_INSERT_QUEUE: {
        const params = toObject(args[0]);
        if (!params) return { changes: 0 };
        const signalId = numberOrZero(params.signal_id);
        const tier = String(params.tier ?? 'pro');
        const payload = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload ?? {});
        const readyAt = numberOrZero(params.ready_at);
        const key = `${signalId}:${tier}`;
        let id = this.publishQueueByKey.get(key);
        if (!id) {
          id = this.nextQueueId++;
          this.publishQueueByKey.set(key, id);
        }
        const row: PublishQueueRow = {
          id,
          signal_id: signalId,
          tier,
          payload,
          ready_at: readyAt,
          sent_at: null,
          attempts: 0,
          last_error: null,
        };
        this.publishQueue.set(id, row);
        return { changes: 1, lastInsertRowid: id };
      }
      case SQL_MARK_SUCCESS: {
        const [sentAt, id] = args;
        const row = this.publishQueue.get(numberOrZero(id));
        if (!row) return { changes: 0 };
        row.sent_at = numberOrZero(sentAt);
        row.attempts = (row.attempts ?? 0) + 1;
        row.last_error = null;
        this.publishQueue.set(row.id, row);
        return { changes: 1 };
      }
      case SQL_MARK_FAILURE: {
        const [error, id] = args;
        const row = this.publishQueue.get(numberOrZero(id));
        if (!row) return { changes: 0 };
        row.attempts = (row.attempts ?? 0) + 1;
        row.last_error = error === null || error === undefined ? null : String(error);
        row.ready_at = (row.ready_at ?? 0) + 600;
        this.publishQueue.set(row.id, row);
        return { changes: 1 };
      }
      case SQL_UPSERT_METRIC: {
        const [signalId, tier, entryPrice, sentAt] = args;
        const key = `${numberOrZero(signalId)}:${String(tier ?? 'pro')}`;
        const row = this.signalMetrics.get(key) ?? {
          signal_id: numberOrZero(signalId),
          tier: String(tier ?? 'pro'),
          entry_price: null,
          sent_at: null,
        };
        row.entry_price = entryPrice === null || entryPrice === undefined ? null : Number(entryPrice);
        row.sent_at = sentAt === null || sentAt === undefined ? null : numberOrZero(sentAt);
        this.signalMetrics.set(key, row);
        return { changes: 1 };
      }
      case SQL_UPSERT_LEDGER: {
        const params = toObject(args[0]);
        if (!params) return { changes: 0 };
        const ledgerDate = String(params.ledger_date ?? '');
        const assetClass = String(params.asset_class ?? '');
        if (!ledgerDate || !assetClass) return { changes: 0 };
        const key = `${ledgerDate}:${assetClass}`;
        const count = Math.max(Math.floor(numberOrZero(params.count)), 0);
        this.publishLedger.set(key, {
          ledger_date: ledgerDate,
          asset_class: assetClass,
          count,
          last_updated: this.nowSec(),
        });
        return { changes: 1 };
      }
      case SQL_UPSERT_LOCK: {
        const [name, expiresAt] = args;
        if (!name) return { changes: 0 };
        this.locks.set(String(name), { expires_at: numberOrZero(expiresAt) });
        return { changes: 1 };
      }
      case SQL_DELETE_LOCK: {
        const [name] = args;
        if (!name) return { changes: 0 };
        const existed = this.locks.delete(String(name));
        return { changes: existed ? 1 : 0 };
      }
      default:
        this.logUnhandled('run', sql);
        return { changes: 0 };
    }
  }

  executeGet(sql: string, args: any[]): any {
    switch (sql) {
      case SQL_SELECT_USER_TIER: {
        const [id] = args;
        const row = this.users.get(String(id));
        return row ? { tier: row.tier } : undefined;
      }
      case SQL_SELECT_SNAPSHOT: {
        const [source] = args;
        const row = this.dataSnapshots.get(String(source));
        return row ? { ...row } : undefined;
      }
      case SQL_SELECT_SIGNAL_ID: {
        const [uniqKey] = args;
        const id = this.signalByUniq.get(String(uniqKey));
        return typeof id === 'number' ? { id } : undefined;
      }
      case SQL_SELECT_LEDGER_SINGLE: {
        const [date, asset] = args;
        const key = `${String(date)}:${String(asset)}`;
        const row = this.publishLedger.get(key);
        return row ? { count: row.count } : undefined;
      }
      case SQL_SELECT_LOCK: {
        const [name] = args;
        const row = this.locks.get(String(name));
        return row ? { expires_at: row.expires_at } : undefined;
      }
      default:
        this.logUnhandled('get', sql);
        return undefined;
    }
  }

  executeAll(sql: string, args: any[]): any[] {
    switch (sql) {
      case SQL_SELECT_QUEUE_READY: {
        const readyAt = numberOrZero(args[0]);
        const limit = args[1] === undefined ? Infinity : Number(args[1]);
        return Array.from(this.publishQueue.values())
          .filter((row) => row.ready_at <= readyAt && row.sent_at === null)
          .sort((a, b) => a.ready_at - b.ready_at)
          .slice(0, Number.isFinite(limit) ? Number(limit) : undefined)
          .map((row) => ({
            id: row.id,
            signal_id: row.signal_id,
            tier: row.tier,
            payload: row.payload,
            attempts: row.attempts,
            features: this.signals.get(row.signal_id)?.features ?? null,
          }));
      }
      case SQL_WEEKLY_SUMMARY: {
        const since = numberOrZero(args[0]);
        return Array.from(this.publishQueue.values())
          .filter((row) => row.sent_at !== null && (row.sent_at ?? 0) >= since)
          .map((row) => {
            const signal = this.signals.get(row.signal_id);
            if (!signal) return null;
            const metric = this.signalMetrics.get(`${row.signal_id}:${row.tier}`);
            return {
              tier: row.tier,
              sent_at: row.sent_at,
              symbol: signal.symbol,
              score: signal.score,
              features: signal.features,
              entry_price: metric?.entry_price,
              exit_price_1d: metric?.exit_price_1d ?? null,
              exit_price_3d: metric?.exit_price_3d ?? null,
            };
          })
          .filter(Boolean) as any[];
      }
      case SQL_LAST_SENT: {
        const map = new Map<string, { symbol: string; asset_type: string; last_sent: number | null }>();
        for (const row of this.publishQueue.values()) {
          if (row.sent_at === null) continue;
          const signal = this.signals.get(row.signal_id);
          if (!signal) continue;
          const key = `${signal.asset_type}:${signal.symbol}`;
          const current = map.get(key);
          if (!current || (row.sent_at ?? 0) > (current.last_sent ?? 0)) {
            map.set(key, { symbol: signal.symbol, asset_type: signal.asset_type, last_sent: row.sent_at });
          }
        }
        return Array.from(map.values());
      }
      case SQL_POSTED_TODAY: {
        const since = numberOrZero(args[0]);
        const counts = new Map<string, Set<number>>();
        for (const row of this.publishQueue.values()) {
          if (row.sent_at === null || (row.sent_at ?? 0) < since) continue;
          const signal = this.signals.get(row.signal_id);
          if (!signal) continue;
          if (!counts.has(signal.asset_type)) counts.set(signal.asset_type, new Set());
          counts.get(signal.asset_type)!.add(row.signal_id);
        }
        return Array.from(counts.entries()).map(([asset, set]) => ({
          asset_type: asset,
          cnt: set.size,
        }));
      }
      case SQL_SELECT_LEDGER_COUNTS: {
        const [date] = args;
        return Array.from(this.publishLedger.values())
          .filter((row) => row.ledger_date === String(date))
          .map((row) => ({ asset_class: row.asset_class, count: row.count }));
      }
      default:
        this.logUnhandled('all', sql);
        return [];
    }
  }

  private logUnhandled(type: 'run' | 'get' | 'all', sql: string) {
    const key = `${type}:${sql}`;
    if (this.unhandled.has(key)) return;
    this.unhandled.add(key);
    console.warn(`[db-fallback] unhandled ${type} SQL -> ${sql}`);
  }
}

function toObject(value: any): Record<string, any> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return undefined;
}

function numberOrZero(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function formatReason(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'FREE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_type TEXT CHECK(asset_type IN ('stock','crypto')) NOT NULL,
  tier_min TEXT CHECK(tier_min IN ('free','pro','elite')) NOT NULL,
  score REAL NOT NULL,
  reason TEXT NOT NULL,
  features TEXT,
  created_at INTEGER NOT NULL,
  embargo_until INTEGER,
  uniq_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_embargo ON signals(embargo_until);

CREATE TABLE IF NOT EXISTS publish_queue (
  id INTEGER PRIMARY KEY,
  signal_id INTEGER NOT NULL,
  tier TEXT CHECK(tier IN ('free','pro','elite')) NOT NULL,
  payload TEXT NOT NULL,
  ready_at INTEGER NOT NULL,
  sent_at INTEGER,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  UNIQUE(signal_id, tier),
  FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_publish_queue_ready ON publish_queue(ready_at, sent_at);

CREATE TABLE IF NOT EXISTS data_snapshots (
  source TEXT NOT NULL,
  asset TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  ttl_seconds INTEGER DEFAULT 900,
  PRIMARY KEY (source, asset)
);

CREATE TABLE IF NOT EXISTS research_events (
  id TEXT PRIMARY KEY,
  source TEXT,
  symbol TEXT,
  chain TEXT,
  category TEXT,
  data TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locks (
  name TEXT PRIMARY KEY,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS signal_metrics (
  id INTEGER PRIMARY KEY,
  signal_id INTEGER NOT NULL,
  tier TEXT CHECK(tier IN ('free','pro','elite')) NOT NULL,
  entry_price REAL,
  sent_at INTEGER NOT NULL,
  exit_price_1d REAL,
  exit_price_3d REAL,
  pnl_1d REAL,
  pnl_3d REAL,
  FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE,
  UNIQUE(signal_id, tier)
);
CREATE INDEX IF NOT EXISTS idx_metrics_signal ON signal_metrics(signal_id);

CREATE TABLE IF NOT EXISTS publish_ledger (
  ledger_date TEXT NOT NULL,
  asset_class TEXT CHECK(asset_class IN ('stock','crypto','weekly')) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (ledger_date, asset_class)
);
`;

const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
const sqlitePath = process.env.AURORA_SQLITE_PATH;

let database: any;

if (!sqlitePath) {
  if (nodeEnv === 'test') {
    console.log('[db] using in-memory sqlite for tests');
    database = new MemoryDB();
    database.exec(schema);
  } else {
    throw new Error('[db] AURORA_SQLITE_PATH must be set outside of tests');
  }
} else {
  try {
    const module = await import('better-sqlite3');
    const DatabaseCtor: any = module.default ?? module;
    console.log(`[db] opening sqlite at ${sqlitePath}`);
    database = new DatabaseCtor(sqlitePath);
    if (typeof database.pragma === 'function') {
      database.pragma('journal_mode = WAL');
    }
    if (typeof database.exec === 'function') {
      database.exec(schema);
    }
  } catch (err) {
    if (nodeEnv === 'test') {
      console.log('[db] using in-memory sqlite for tests');
      database = new MemoryDB();
      database.exec(schema);
    } else {
      throw new Error(`[db] failed to open sqlite at ${sqlitePath}: ${formatReason(err)}`);
    }
  }
}

export default database;
