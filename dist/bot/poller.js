let TelegramBot; try { TelegramBot = (await import('node-telegram-bot-api')).default; } catch {}
import { PRICES } from '../config/pricing.js';
const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!TelegramBot || !token) { console.log('[BOT] disabled (missing token/lib)'); process.exit(0); }
const bot = new TelegramBot(token, { polling: true });
const pricingText = () => ['*Plans*', `Free — $0/mo`, `Pro — $${PRICES.PRO.monthly}/mo`, `Elite — $${PRICES.ELITE.monthly}/mo`].join('\n');
bot.onText(/^\/start|\/help/, (m)=> bot.sendMessage(m.chat.id, `Welcome!\n${pricingText()}\n\nUse /pricing or /upgrade`, { parse_mode:'Markdown' }));
bot.onText(/^\/pricing/,       (m)=> bot.sendMessage(m.chat.id, pricingText(), { parse_mode:'Markdown' }));
bot.onText(/^\/upgrade/,       (m)=> {
  const p = process.env.CHECKOUT_PRO_URL || 'https://example.com/pro';
  const e = process.env.CHECKOUT_ELITE_URL || 'https://example.com/elite';
  bot.sendMessage(m.chat.id, `Upgrade links:\nPro: ${p}\nElite: ${e}`);
});
console.log('[BOT] polling started');
