import TelegramBot from 'node-telegram-bot-api';
import { request } from 'undici';

const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
const chats = {
  FREE:  process.env.TELEGRAM_CHAT_ID_FREE  || '',
  PRO:   process.env.TELEGRAM_CHAT_ID_PRO   || '',
  ELITE: process.env.TELEGRAM_CHAT_ID_ELITE || '',
};

export async function postTelegram(tier:'FREE'|'PRO'|'ELITE', text:string) {
  if(!tgToken || !chats[tier]) return false;
  const bot = new TelegramBot(tgToken, { polling:false });
  await bot.sendMessage(chats[tier]!, text, { disable_web_page_preview:true });
  return true;
}

export async function postX(text:string) {
  // Placeholder: use your preferred X client. Here we just log.
  // Implement with OAuth 1.0a or OAuth 2.0 (v2) using environment keys.
  console.log('[X]', text);
  return true;
}
