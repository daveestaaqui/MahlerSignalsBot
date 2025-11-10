// Local-only marketing message composer. Does NOT send network requests.
import fs from 'node:fs';
import path from 'node:path';
import brandCopy from '../branding/copy.json' assert { type: 'json' };

function loadTemplate(kind) {
  const filename = kind === 'weekly' ? 'weekly.json' : 'daily.json';
  const filePath = path.join('marketing', 'templates', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function fill(template, vars) {
  const replacer = (s) =>
    s.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '',
    );
  const copy = JSON.parse(JSON.stringify(template));
  if (typeof copy.title === 'string') copy.title = replacer(copy.title);
  if (typeof copy.body === 'string') copy.body = replacer(copy.body);
  if (typeof copy.summary === 'string') copy.summary = replacer(copy.summary);
  if (typeof copy.disclaimer === 'string') copy.disclaimer = replacer(copy.disclaimer);
  if (Array.isArray(copy.sections)) {
    copy.sections = copy.sections.map((section) => ({
      ...section,
      content: typeof section.content === 'string' ? replacer(section.content) : section.content,
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

function loadSignals(source) {
  if (!source) return [];
  try {
    if (fs.existsSync(source)) {
      const data = fs.readFileSync(source, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // ignore and fallback to parsing raw string below
  }
  try {
    return JSON.parse(source);
  } catch {
    return [];
  }
}

function deriveSignalVars(signals) {
  if (!Array.isArray(signals) || !signals.length) return {};
  const top = signals.slice(0, 3);
  const first = top[0] ?? {};
  const summary = summarizeSignals(top);
  const equities = signals.filter((signal) => (signal?.assetClass ?? '').toLowerCase() === 'equity');
  const crypto = signals.filter((signal) => (signal?.assetClass ?? '').toLowerCase() !== 'equity');

  return {
    primary_symbol: first?.symbol || '',
    primary_expected_move: first?.expectedMove || '',
    primary_rationale:
      (Array.isArray(first?.rationale) && first.rationale.length ? first.rationale[0] : '') || '',
    top_rationales: summary,
    equity_summary: summarizeSignals(equities) || summary,
    crypto_summary: summarizeSignals(crypto) || summary,
  };
}

function summarizeSignals(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list
    .map((signal) => {
      const base = typeof signal?.symbol === 'string' ? signal.symbol : 'Signal';
      const rationale =
        (Array.isArray(signal?.rationale) && signal.rationale.length
          ? signal.rationale[0]
          : signal?.expectedMove) || '';
      const timeframe = signal?.timeframe ? ` (${signal.timeframe})` : '';
      return `${base}${timeframe}: ${rationale}`.trim();
    })
    .filter(Boolean)
    .join(' • ');
}

const [, , kind = 'daily', ...kv] = process.argv;
const rawVars = parseVars(kv);
const signals = loadSignals(rawVars.signals);
delete rawVars.signals;

const vars = {
  disclaimer: brandCopy.disclaimerShort,
  about: brandCopy.aboutAurora,
  ...deriveSignalVars(signals),
  ...rawVars,
};

const tpl = loadTemplate(kind);
const filled = fill(tpl, vars);
console.log(JSON.stringify(filled, null, 2));
