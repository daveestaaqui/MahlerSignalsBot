import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcPath = path.join(projectRoot, 'src/config/pricing.ts');
const outPath = path.join(projectRoot, 'dist/config/pricing.js');

if (!(await fileExists(srcPath))) {
  console.error(`Source TypeScript file not found: ${srcPath}`);
  process.exit(1);
}

let code = await fs.readFile(srcPath, 'utf8');
code = code.replace(/^export type[^\n]*$/gm, '');
code = code.replace(/\s+as const\b/g, '');

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, code);
console.log('Emitted', path.relative(projectRoot, outPath));

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
