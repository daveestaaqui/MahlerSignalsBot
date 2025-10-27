import db from './db.js';

const selectLock = db.prepare('SELECT expires_at FROM locks WHERE name = ?');
const upsertLock = db.prepare('INSERT INTO locks(name, expires_at) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET expires_at = excluded.expires_at');
const deleteLock = db.prepare('DELETE FROM locks WHERE name = ?');

export function acquireLock(name:string, ttlSeconds:number): boolean {
  const now = Math.floor(Date.now()/1000);
  const row = selectLock.get(name) as { expires_at:number } | undefined;
  if(row && row.expires_at && row.expires_at > now){
    return false;
  }
  upsertLock.run(name, now + ttlSeconds);
  return true;
}

export function releaseLock(name:string){
  deleteLock.run(name);
}
