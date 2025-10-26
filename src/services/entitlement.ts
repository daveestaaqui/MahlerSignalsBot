import db from '../lib/db.js';
import { TIERS, type Tier } from '../config/pricing.js';
export function setTier(userId: string, tier: Tier) {
  if(!TIERS.includes(tier)) throw new Error('Invalid tier');
  const stmt = db.prepare("INSERT INTO users (id, tier) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tier=excluded.tier");
  stmt.run(userId, tier);
}
export function getTier(userId: string): Tier {
  const row: any = db.prepare("SELECT tier FROM users WHERE id=?").get(userId);
  return (row?.tier ?? 'FREE') as Tier;
}
