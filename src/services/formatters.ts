type AssetClass = 'stock' | 'crypto';
type Tier = 'elite' | 'pro' | 'free';

export type MessageBase = {
  symbol: string;
  price?: number;
  pct?: number;
  rvol?: number;
  reason?: string;
  score: number;
  subs?: Record<string, number>;
  assetType: AssetClass;
  extras?: {
    support?: number;
    resistance?: number;
    timeframe?: string;
    riskNote?: string;
  };
};

export type FormattedMessage = {
  telegram: string;
  plain: string;
  compact: string;
};

type Bundle = {
  tier: Tier;
  asset: AssetClass;
  entries: MessageBase[];
};

const tierMeta: Record<Tier, { emoji: string; label: string; risk: string; cta: string }> = {
  elite: {
    emoji: '👑',
    label: 'ELITE',
    risk: 'Risk: commit ≤1.0R; trail after locking +1R.',
    cta: 'CTA: Sync with desk for execution and risk overlays.',
  },
  pro: {
    emoji: '⭐',
    label: 'PRO',
    risk: 'Risk: commit ≤0.75R; respect structure stops.',
    cta: 'CTA: Execute via Aurora Portal; journal fills within 15m.',
  },
  free: {
    emoji: '⌛',
    label: 'FREE',
    risk: 'Risk: 24h delay; manage entries with wider stops.',
    cta: 'CTA: Upgrade for realtime alerts + desk support.',
  },
};

export function fmtEliteStock(entries: MessageBase[]): FormattedMessage {
  return formatBundle({ tier: 'elite', asset: 'stock', entries });
}

export function fmtEliteCrypto(entries: MessageBase[]): FormattedMessage {
  return formatBundle({ tier: 'elite', asset: 'crypto', entries });
}

export function fmtPro(asset: AssetClass, entries: MessageBase[]): FormattedMessage {
  return formatBundle({ tier: 'pro', asset, entries });
}

export function fmtFreeTeaser(asset: AssetClass, entries: MessageBase[]): FormattedMessage {
  return formatBundle({ tier: 'free', asset, entries });
}

export function eliteStockMessage(entry: MessageBase | MessageBase[]): string {
  return fmtEliteStock(asArray(entry)).telegram;
}

export function eliteCryptoMessage(entry: MessageBase | MessageBase[]): string {
  return fmtEliteCrypto(asArray(entry)).telegram;
}

export function proMessage(entry: MessageBase | MessageBase[]): string {
  const items = asArray(entry);
  const asset = items[0]?.assetType ?? 'stock';
  return fmtPro(asset, items).telegram;
}

export function freeTeaser(entry: MessageBase | MessageBase[]): string {
  const items = asArray(entry);
  const asset = items[0]?.assetType ?? 'stock';
  return fmtFreeTeaser(asset, items).telegram;
}

export function formatWeeklyDigestMessage(summary: {
  header: string;
  bullets: string[];
  cta?: string;
}): FormattedMessage {
  const lines = [escapeHtml(summary.header), ...summary.bullets.map((line) => `• ${escapeHtml(line)}`)];
  if (summary.cta) {
    lines.push(escapeHtml(summary.cta));
  }
  const telegram = lines.join('\n');
  const plain = stripHtml(telegram);
  const compact = compactText(plain);
  return { telegram, plain, compact };
}

function formatBundle(bundle: Bundle): FormattedMessage {
  const { tier, asset, entries } = bundle;
  const header = headerLine(tier, asset, entries.length > 1 ? 'High-Conviction Set' : 'High-Conviction Signal');
  if (!entries.length) {
    const fallback = `${header}\nNo qualifying signals for this window.`;
    return {
      telegram: fallback,
      plain: stripHtml(fallback),
      compact: compactText(fallback),
    };
  }

  const body: string[] = [];
  for (const entry of entries) {
    body.push(renderEntry(tier, asset, entry));
  }

  const footer = [
    tierMeta[tier].risk,
    tierMeta[tier].cta,
    'Trade: https://aurorasignalx.app/trade | Connect: https://aurorasignalx.app/connect',
  ].map(escapeHtml);

  const telegram = [header, ...body, ...footer].join('\n');
  const plain = stripHtml(telegram);
  const compact = compactText(plain);
  return { telegram, plain, compact };
}

function renderEntry(tier: Tier, asset: AssetClass, entry: MessageBase): string {
  const lines: string[] = [];
  const plan = buildPlan(entry);
  const scoreLine = buildScoreLine(entry);
  const triggers = buildTriggers(entry.reason);
  const planLine = `Plan: Entry ${priceFmt(entry.price)} · Stop ${priceFmt(plan.stop)} · Target ${priceFmt(plan.target)} · R/R ${rrFmt(
    plan.rr,
  )}`;
  const riskLine = entry.extras?.riskNote
    ? `Risk: ${escapeHtml(entry.extras.riskNote)}`
    : `Risk: ${tierMeta[tier].risk.replace(/^Risk:\s*/i, '')}`;

  const contextParts = [
    entry.assetType === 'stock' ? 'Equity' : 'Crypto',
    entry.extras?.timeframe ? entry.extras.timeframe : 'Swing',
    entryContext(entry),
  ].filter(Boolean);

  lines.push(
    `• <b>${escapeHtml(entry.symbol)}</b> | ${escapeHtml(contextParts.join(' · '))}`,
  );
  lines.push(`  ${escapeHtml(scoreLine)}`);
  if (triggers.length) {
    lines.push(`  Triggers: ${triggers.map((t) => escapeHtml(t)).join(' • ')}`);
  }
  lines.push(`  ${escapeHtml(planLine)}`);
  lines.push(`  ${escapeHtml(riskLine)}`);
  return lines.join('\n');
}

function headerLine(tier: Tier, asset: AssetClass, type: string): string {
  const meta = tierMeta[tier];
  const assetLabel = asset === 'stock' ? 'STOCK' : 'CRYPTO';
  return `${meta.emoji} [${meta.label}] ${assetLabel} ${type.toUpperCase()}`;
}

function buildPlan(entry: MessageBase): { stop?: number; target?: number; rr?: number } {
  const price = entry.price;
  if (!price || price <= 0) return {};
  const volatility = Math.max(Math.abs(entry.pct ?? 0.03), 0.015);
  const stop = entry.extras?.support ?? price * (1 - Math.max(0.015, volatility * 0.6));
  const target = entry.extras?.resistance ?? price * (1 + Math.max(0.03, volatility * 1.8));
  const rr = (target - price) / Math.max(price - stop, 0.0001);
  return { stop, target, rr };
}

function buildScoreLine(entry: MessageBase): string {
  const score = scoreFmt(entry.score);
  const breakdown = conviction(entry.subs);
  return `Score ${score}/100 (${breakdown})`;
}

function buildTriggers(reason?: string): string[] {
  if (!reason) return [];
  return reason
    .split(/[\n•|-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 2);
}

function conviction(subs: Record<string, number> | undefined): string {
  const dimensions: Array<{ key: string; label: string }> = [
    { key: 'tech', label: 'Tech' },
    { key: 'flow', label: 'Flow' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'fundamental', label: 'Fundamentals' },
    { key: 'options', label: 'Options' },
  ];
  const weights = dimensions.map(({ key }) => Math.max(subs?.[key] ?? 0, 0));
  const total = weights.reduce((acc, value) => acc + value, 0) || 1;
  return dimensions
    .map(({ label }, index) => `${label} ${(weights[index] / total * 100).toFixed(0)}%`)
    .join(' • ');
}

function entryContext(entry: MessageBase): string {
  const trend = entry.pct !== undefined ? `Δ ${pctFmt(entry.pct)}` : 'Δ —';
  const rvol = entry.rvol !== undefined ? `RVOL ${rvolFmt(entry.rvol)}` : 'RVOL —';
  return `${trend} · ${rvol}`;
}

function asArray(entry: MessageBase | MessageBase[]): MessageBase[] {
  return Array.isArray(entry) ? entry : [entry];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

function compactText(value: string, limit = 220): string {
  const compressed = value.replace(/\s+/g, ' ').trim();
  if (compressed.length <= limit) return compressed;
  return `${compressed.slice(0, limit - 1)}…`;
}

function priceFmt(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const digits = value >= 10 ? 2 : value >= 1 ? 3 : 4;
  return `$${value.toFixed(digits)}`;
}

function pctFmt(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function rvolFmt(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function scoreFmt(score: number): string {
  return `${Math.round(score * 100)}`;
}

function rrFmt(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}
