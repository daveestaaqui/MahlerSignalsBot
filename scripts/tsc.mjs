import { spawn } from 'node:child_process';
const proc = spawn(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio:'inherit' });
proc.on('exit', (code)=>process.exit(code||0));
