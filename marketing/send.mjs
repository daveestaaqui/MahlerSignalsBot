// Local-only marketing message composer. Does NOT send network requests.
import fs from 'node:fs';
import path from 'node:path';

function loadTemplate(kind) {
  const filename = kind === 'weekly' ? 'weekly.json' : 'daily.json';
  const filePath = path.join('marketing', 'templates', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function fill(template, vars) {
  const replacer = (s) =>
    s.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
    );
  const copy = JSON.parse(JSON.stringify(template));
  if (typeof copy.title === 'string') copy.title = replacer(copy.title);
  if (typeof copy.body === 'string') copy.body = replacer(copy.body);
  if (Array.isArray(copy.sections)) {
    copy.sections = copy.sections.map(section => ({
      ...section,
      content: typeof section.content === 'string' ? replacer(section.content) : section.content
    }));
  }
  return copy;
}

function parseVars(args) {
  const out = {};
  for (const arg of args) {
    const [k, ...rest] = arg.split('=');
    if (!k || !rest.length) continue;
    out[k] = rest.join('=');
  }
  return out;
}

const [,, kind = 'daily', ...kv] = process.argv;
const vars = parseVars(kv);
const tpl = loadTemplate(kind);
const filled = fill(tpl, vars);
console.log(JSON.stringify(filled, null, 2));
