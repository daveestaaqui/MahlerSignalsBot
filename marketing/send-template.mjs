#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import brandCopy from '../branding/copy.json' assert { type: 'json' };

const FALLBACK_DISCLAIMER =
  'This system provides automated market analysis for informational purposes only and does not constitute financial, investment, or trading advice.';
const FALLBACK_ABOUT =
  'Aurora-Signals pairs real market + on-chain data with automated risk notes so desks can review high-signal setups quickly.';
const usage = 'Usage: node marketing/send-template.mjs <daily|weekly> <context.json>';
const [, , templateName, contextFile] = process.argv;

if (!templateName || !contextFile) {
  console.error(usage);
  process.exit(1);
}

try {
  const template = loadTemplate(templateName);
  const context = loadContext(contextFile);
  const signals = Array.isArray(context.signals) ? context.signals : [];
  const derived = deriveSignalVars(signals);
  const vars = {
    date: context.date || new Date().toISOString().slice(0, 10),
    week: context.week || deriveWeekLabel(new Date()),
    ...derived,
    ...context,
    about: brandCopy.aboutAurora || brandCopy.aboutBlurb || FALLBACK_ABOUT,
    disclaimer: brandCopy.disclaimerShort || FALLBACK_DISCLAIMER,
  };
  const filled = applyTemplate(template, vars);
  enforceContract(filled);
  console.log(JSON.stringify(filled, null, 2));
} catch (error) {
  console.error('[marketing] template build failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}

function loadTemplate(kind) {
  const file = kind === 'weekly' ? 'weekly.json' : 'daily.json';
  const filePath = path.join('marketing', 'templates', file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function loadContext(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? { signals: parsed } : parsed;
}

function deriveSignalVars(signals) {
  if (!Array.isArray(signals) || !signals.length) {
    return {};
  }
  const top = signals.slice(0, 3);
  const first = top[0] || {};
  const summary = summarizeSignals(top);
  const equities = signals.filter((signal) => (signal?.assetClass || '').toLowerCase() === 'equity');
  const crypto = signals.filter((signal) => (signal?.assetClass || '').toLowerCase() !== 'equity');

  return {
    primary_symbol: first.symbol || '',
    primary_expected_move: describeExpectedMove(first),
    primary_rationale: extractLeadRationale(first) || '',
    top_rationales: summary,
    equity_summary: summarizeSignals(equities) || summary,
    crypto_summary: summarizeSignals(crypto) || summary,
  };
}

function summarizeSignals(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list
    .map((signal) => {
      const symbol = typeof signal?.symbol === 'string' ? signal.symbol : 'Signal';
      const timeframe = signal?.timeframe ? ` (${signal.timeframe})` : '';
      const move = describeExpectedMove(signal);
      const rationale = extractLeadRationale(signal);
      return `${symbol}${timeframe}: ${move}${rationale ? ` — ${rationale}` : ''}`.trim();
    })
    .filter(Boolean)
    .join(' • ');
}

function extractLeadRationale(signal) {
  if (Array.isArray(signal?.rationales) && signal.rationales.length) {
    return String(signal.rationales[0]);
  }
  if (Array.isArray(signal?.rationale) && signal.rationale.length) {
    return String(signal.rationale[0]);
  }
  return '';
}

function describeExpectedMove(signal) {
  const block = signal?.expectedMove;
  if (block && typeof block === 'object' && block?.rangePct) {
    const min = toNumber(block.rangePct.min);
    const max = toNumber(block.rangePct.max);
    const bias = typeof block.directionBias === 'string' ? block.directionBias : 'neutral';
    const horizon = block.horizon || signal?.timeframe || 'stated horizon';
    return `model-estimated ${bias} move between ${min.toFixed(1)}% and ${max.toFixed(1)}% over ${horizon}`;
  }
  if (typeof block === 'string') {
    return block;
  }
  if (typeof signal?.expectedMove === 'string') {
    return signal.expectedMove;
  }
  return '';
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function applyTemplate(template, vars) {
  if (typeof template === 'string') {
    return replaceVars(template, vars);
  }
  if (Array.isArray(template)) {
    return template.map((item) => applyTemplate(item, vars));
  }
  if (template && typeof template === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(template)) {
      out[key] = applyTemplate(value, vars);
    }
    return out;
  }
  return template;
}

function replaceVars(text, vars) {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
  });
}

function deriveWeekLabel(date) {
  const target = new Date(date.valueOf());
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `Week ${week}`;
}

function enforceContract(payload) {
  const required = ['title', 'body', 'cta', 'disclaimer'];
  for (const key of required) {
    if (typeof payload[key] !== 'string' || payload[key].trim().length === 0) {
      throw new Error(`Template missing required field: ${key}`);
    }
  }
}
