// @ts-nocheck
import db from '../lib/db.js';
import { TIERS } from '../config/pricing.js';
export function setTier(userId, tier) {
    if (!TIERS.includes(tier))
        throw new Error('Invalid tier');
    const stmt = db.prepare("INSERT INTO users (id, tier) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tier=excluded.tier");
    stmt.run(userId, tier);
}
export function getTier(userId) {
    const row = db.prepare("SELECT tier FROM users WHERE id=?").get(userId);
    return (row?.tier ?? 'FREE');
}
