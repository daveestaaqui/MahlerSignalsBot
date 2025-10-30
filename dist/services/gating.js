import { CRYPTO_MAJORS, TIER_GATES } from '../config/tiers.js';
export function canPublish(tier, dimension) {
    const gate = TIER_GATES[tier];
    if (!gate)
        return false;
    if (dimension.asset === 'crypto') {
        if (!gate.crypto)
            return false;
        if (gate.cryptoMajorsOnly) {
            const symbol = dimension.symbol?.toUpperCase();
            if (!symbol || !CRYPTO_MAJORS.has(symbol)) {
                return false;
            }
        }
    }
    if (dimension.asset === 'stock' && !gate.stocks) {
        return false;
    }
    if (dimension.whale && !gate.whale)
        return false;
    if (dimension.congress && !gate.congress)
        return false;
    if (dimension.options && !gate.options)
        return false;
    return true;
}
