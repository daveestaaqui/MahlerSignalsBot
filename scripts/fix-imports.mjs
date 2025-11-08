import fs from 'fs', path from 'path';
const root='src', files=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); e.isDirectory()?walk(p):p.endsWith('.ts')&&files.push(p);}})(root);
const rx1=/(\bfrom\s+['"].[^'"\n]+)\.js(['"])/g, rx2=/(\bexport\s+\*\s+from\s+['"].[^'"\n]+)\.js(['"])/g;
let changed=0; for(const f of files){ const s=fs.readFileSync(f,'utf8'); const o=s.replace(rx1,'$1$2').replace(rx2,'$1$2'); if(o!==s){ fs.writeFileSync(f,o); changed++; } }
console.log(JSON.stringify({changed},null,2));
