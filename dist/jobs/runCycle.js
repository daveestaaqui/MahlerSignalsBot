const log = (...a) => console.log(new Date().toISOString(), ...a);
import db from '../lib/db.js';
import { selectTop } from './signalEngine.js';
import { postTelegram, postX } from '../services/posters.js';
import { postDiscord } from '../services/posters_discord.js';
function saveSignals(items){ const stmt=db.prepare?.("INSERT OR REPLACE INTO signals (id, ts, chain, symbol, score, summary, tier) VALUES (?, ?, ?, ?, ?, ?, ?)"); const tx=(arr)=>arr.forEach(s=>stmt?.run?.(s.id, new Date(s.ts).toISOString(), s.chain, s.symbol, s.score, s.summary, s.tier)); tx(items); }
export async function runOnce(){
  const { pro, elite } = await selectTop(3,3); saveSignals([...pro,...elite]);
  const proText = pro.map(s=>`⭐ PRO ${s.chain}:${s.symbol} — ${s.summary}`).join('\n');
  const eliteText = elite.map(s=>`👑 ELITE ${s.chain}:${s.symbol} — ${s.summary}`).join('\n');
  if(pro.length){ await postTelegram('PRO', proText); await postDiscord('PRO', proText);} 
  if(elite.length){ await postTelegram('ELITE', eliteText); await postDiscord('ELITE', eliteText);} 
  const tease = pro.slice(0,1).concat(elite.slice(0,1)).map(s=>`${s.chain}:${s.symbol} (${s.score})`).join(' • ');
  const teaser = `Today’s highlights: ${tease}\nUpgrade: Pro $14 | Elite $39`;
  await postTelegram('FREE', teaser);
  await postDiscord('FREE', teaser);
  await postX(`Signals: ${tease} | Pro $14 • Elite $39`);
}
