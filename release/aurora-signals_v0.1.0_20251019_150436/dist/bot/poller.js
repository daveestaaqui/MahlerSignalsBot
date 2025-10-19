let TelegramBot; try { TelegramBot = (await import('node-telegram-bot-api')).default; } catch {}
import { PRICES } from '../config/pricing.js';
import { isAllowed, setTier } from '../services/gating.js';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!TelegramBot || !token) {
  console.log('[BOT] disabled (missing token/lib)');
  process.exit(0);
}

const ADMIN = (process.env.ADMIN_TELEGRAM_ID || '').trim();
const bot = new TelegramBot(token, { polling: true });

const pricingText = () => [
  '*Plans*',
  'Free — $0/mo',
  `Pro — $${PRICES.PRO.monthly}/mo`,
  `Elite — $${PRICES.ELITE.monthly}/mo`
].join('\n');

function checkoutMessage() {
  const pro = process.env.CHECKOUT_PRO_URL || 'https://example.com/pro';
  const elite = process.env.CHECKOUT_ELITE_URL || 'https://example.com/elite';
  return `Upgrade links:\nPro: ${pro}\nElite: ${elite}`;
}

bot.onText(/^\/start|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `Welcome!\n${pricingText()}\n\nCommands: /pricing /pro /elite /signals`, { parse_mode: 'Markdown' });
});

bot.onText(/^\/pricing$/, (msg) => {
  bot.sendMessage(msg.chat.id, pricingText(), { parse_mode: 'Markdown' });
});

bot.onText(/^\/pro$/, (msg) => {
  bot.sendMessage(msg.chat.id, `Pro checkout: ${process.env.CHECKOUT_PRO_URL || 'https://example.com/pro'}`);
});

bot.onText(/^\/elite$/, (msg) => {
  bot.sendMessage(msg.chat.id, `Elite checkout: ${process.env.CHECKOUT_ELITE_URL || 'https://example.com/elite'}`);
});

bot.onText(/^\/signals$/, async (msg) => {
  const uid = String(msg.from.id);
  if (!isAllowed(uid, 'PRO')) {
    bot.sendMessage(msg.chat.id, checkoutMessage());
    return;
  }
  let lines = [];
  try {
    const db = (await import('../lib/db.js')).default;
    const rows = db?.prepare?.('SELECT chain, symbol, score, tier FROM signals ORDER BY ts DESC LIMIT 6')?.all?.() || [];
    lines = rows.map((row) => `${row.tier === 'ELITE' ? '👑' : '⭐'} ${row.chain}:${row.symbol} (${row.score})`);
  } catch (err) {
    console.error('[BOT] failed to read signals', err.message);
  }
  if (!lines.length) lines = ['(no signals yet — check back soon)'];
  bot.sendMessage(msg.chat.id, lines.join('\n'));
});

bot.onText(/^\/settier\s+(\d+)\s+(FREE|PRO|ELITE)$/i, (msg, match) => {
  const uid = String(msg.from.id);
  if (!ADMIN || uid !== ADMIN) {
    bot.sendMessage(msg.chat.id, 'Not authorized.');
    return;
  }
  const target = match[1];
  const tier = match[2].toUpperCase();
  try {
    setTier(target, tier);
    bot.sendMessage(msg.chat.id, `Set ${target} → ${tier}`);
  } catch (err) {
    bot.sendMessage(msg.chat.id, 'Failed to set tier');
  }
});

console.log('[BOT] polling started');
