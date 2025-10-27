import Database from 'better-sqlite3';

const db = new Database('db/app.sqlite');
db.pragma('journal_mode = WAL');

db.exec(`
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
`);

export default db;
