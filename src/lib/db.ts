import Database from 'better-sqlite3';
const db = new Database('db/app.sqlite');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'FREE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  ts TEXT, chain TEXT, symbol TEXT, score REAL, summary TEXT, tier TEXT
);
`);
export default db;
