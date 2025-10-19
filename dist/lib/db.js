let Database; try { Database = (await import('better-sqlite3')).default; } catch { Database = null; }
const db = Database ? new Database('db/app.sqlite') : null;
if (db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'FREE', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
           CREATE TABLE IF NOT EXISTS signals (id TEXT PRIMARY KEY, ts TEXT, chain TEXT, symbol TEXT, score REAL, summary TEXT, tier TEXT);`);
}
export default db ?? { prepare(){ return { run(){}, get(){}, all(){}, }}, exec(){} };
