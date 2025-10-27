import { TIER_GATES, type Tier } from '../config/tiers.js';

export type GateContext = {
  asset:'stock'|'crypto';
  whale?:boolean;
  congress?:boolean;
  options?:boolean;
};

export function canPublish(tier:Tier, context:GateContext){
  const gate = TIER_GATES[tier];
  if(!gate) return false;
  if(context.asset === 'crypto' && !gate.crypto) return false;
  if(context.asset === 'stock' && !gate.stocks) return false;
  if(context.whale && !gate.whale) return false;
  if(context.congress && !gate.congress) return false;
  if(context.options && !gate.options) return false;
  return true;
}
