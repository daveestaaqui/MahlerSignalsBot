import { TIER_GATES } from '../config/tiers.js';
export function canPublish(tier, dimension) {
    const g = TIER_GATES[tier];
    if (!g)
        return false;
    if (dimension.asset === 'crypto' && !g.crypto)
        return false;
    if (dimension.asset === 'stock' && !g.stocks)
        return false;
    if (dimension.whale && !g.whale)
        return false;
    if (dimension.congress && !g.congress)
        return false;
    if (dimension.options && !g.options)
        return false;
    return true;
}
