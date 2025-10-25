#!/usr/bin/env node
import { eliteCryptoMessage, eliteStockMessage, proStockMessage, freeTeaser } from '../dist/services/formatters.js';

const now = Math.floor(Date.now()/1000);
const stock = { symbol:'AAPL', asset_type:'stock', score:2.31, reason:'capitulation + RVOL • mean reversion', features:{pct_from_20d:-0.062,pct_from_200d:-0.081,rvol:1.8, smartMoneyScore:0.62, policyTailwind:0.3, sentiment:0.28}, created_at:now };
const coin  = { symbol:'SOL:CCC', asset_type:'crypto', score:1.12, features:{ volumeUSD24h: 120000, whaleScore: 4, momentumScore: 0.9, catalysts:['Mainnet upgrade window']}, created_at:now };

console.log('ELITE STOCK:\n' + eliteStockMessage(stock) + '\n');
console.log('ELITE CRYPTO:\n' + eliteCryptoMessage(coin) + '\n');
console.log('PRO STOCK:\n' + proStockMessage(stock) + '\n');
console.log('FREE TEASER:\n' + freeTeaser(stock) + '\n');
