import { TIERS } from '../config/pricing.js';
import { getTier, setTier } from '../services/entitlement.js';

const order = { FREE: 0, PRO: 1, ELITE: 2 };

export function userTier(userId) {
  return getTier(String(userId));
}

export function isAllowed(userId, minTier) {
  const current = userTier(userId);
  return (order[current] ?? 0) >= (order[minTier] ?? 0);
}

export { setTier };
