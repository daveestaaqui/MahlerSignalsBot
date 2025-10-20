import { execSync } from 'node:child_process';
const patterns = [
  '\\bAKIA[0-9A-Z]{16}\\b', // AWS key pattern example
  'API_KEY', 'SECRET', 'WEBHOOK_SECRET', 'ACCESS_TOKEN',
  'TELEGRAM_BOT_TOKEN', 'DISCORD_WEBHOOK_URL', 'STRIPE_SECRET_KEY'
];
const run = (cmd) => {
  try { return execSync(cmd, { stdio:['ignore','pipe','ignore'] }).toString(); }
  catch { return ''; }
};
console.log('— Working tree scan —');
for(const pat of patterns){
  const out = run(`git ls-files | xargs -I{} sh -c "grep -nHE '${pat}' {} || true"`);
  if(out.trim()) console.log(`[match:${pat}]\n${out}`);
}
console.log('\n— History scan (may be slow) —');
const hist = run(`git rev-list --all | xargs -I{} git grep -nE '${patterns.join('|')}' {}`);
if(hist.trim()) console.log(hist); else console.log('no obvious leaks detected');
