import fs from 'fs';
const file='src/web/admin.ts'; if(!fs.existsSync(file)) { console.log(JSON.stringify({present:false})); process.exit(0); }
let t=fs.readFileSync(file,'utf8'); t=t.replace(/function\s+log\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\}\s*/m,'');
const hdr=`type LogLevel="error"|"warn"|"info"|"log";\nfunction log(level:LogLevel,msg:string,context?:unknown){const m:{[k in LogLevel]:(...a:any[])=>void}={error:console.error.bind(console),warn:console.warn.bind(console),info:console.info.bind(console),log:console.log.bind(console)}; m[level](msg,context??"\"); }`;
if(!/type\s+LogLevel\s*=/.test(t)) t=hdr+"\n"+t; fs.writeFileSync(file,t);
console.log(JSON.stringify({present:true,ensuredLogger:true}));
