const required = [
  'HOST','PORT','SCHEDULE_MS',
  'CHECKOUT_PRO_URL','CHECKOUT_ELITE_URL'
];
let ok=true;
for (const k of required) {
  if (!process.env[k]) { console.warn('⚠️  Missing', k); ok=false; }
}
console.log(ok ? 'env:OK' : 'env:WARN');
process.exit(0);
