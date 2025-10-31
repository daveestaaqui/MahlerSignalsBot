import Database from "better-sqlite3";
export function openDb() {
  const file = process.env.AURORA_SQLITE_PATH || ":memory:";
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}
