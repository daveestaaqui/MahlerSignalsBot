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

const tierMeta = {
  elite: {
    emoji: '👑',
    label: 'ELITE',
    risk: 'Risk: size ≤1.0R, trail once +1R locked.',
  },
  pro: {
    emoji: '⭐',
    label: 'PRO',
    risk: 'Risk: size ≤0.75R, respect structure stops.',
  },
  free: {
    emoji: '⌛',
    label: 'FREE',
    risk: 'Upgrade for realtime entries, stops, and targets.',
  },
} as const;

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

function formatBundle(bundle: Bundle): FormattedMessage {
  const { tier, asset, entries } = bundle;
  if (!entries.length) {
    const fallback = `${headerLine(tier, asset)}\nNo signals selected.`;
    return { telegram: fallback, plain: fallback, compact: fallback };
  }

  const body: string[] = [];
  const compactParts: string[] = [];
  entries.forEach((entry) => {
    const plan = buildPlan(entry);
    const breakdown = conviction(entry.subs);
    const context = entryContext(entry);
    body.push(
      `• <b>${escapeHtml(entry.symbol)}</b> — ${escapeHtml(context)}`,
    );
    body.push(
      `  Trade plan: Entry ${priceFmt(entry.price)} | Stop ${priceFmt(plan.stop)} | Target ${priceFmt(plan.target)} | R/R ${rrFmt(plan.rr)}`,
    );
    body.push(
      `  Conviction: ${escapeHtml(breakdown)} | Score ${scoreFmt(entry.score)}${entry.reason ? ` | Note: ${escapeHtml(entry.reason)}` : ''}`,
    );

    compactParts.push(
      `${tierMeta[tier].emoji} ${entry.symbol}: Entry ${priceFmt(entry.price)}, Stop ${priceFmt(plan.stop)}, Target ${priceFmt(plan.target)}, R/R ${rrFmt(plan.rr)}, Score ${scoreFmt(entry.score)}, Conviction ${breakdown}`,
    );
  });

  body.push(tierMeta[tier].risk);

  const telegram = [headerLine(tier, asset), ...body].join('\n');
  const plain = stripHtml(telegram);
  const compact = compactParts.join(' • ');
  return { telegram, plain, compact };
}

function headerLine(tier: Tier, asset: AssetClass): string {
  const meta = tierMeta[tier];
  const assetLabel = asset === 'stock' ? 'Stocks' : 'Crypto';
  return `${meta.emoji} ${meta.label} • ${assetLabel} • Daily Signals`;
}

function buildPlan(entry: MessageBase): { stop?: number; target?: number; rr?: number } {
  const price = entry.price;
  if (!price || price <= 0) return {};
  const volatility = Math.max(Math.abs(entry.pct ?? 0.03), 0.015);
  const stop = price * (1 - Math.max(0.015, volatility * 0.6));
  const target = price * (1 + Math.max(0.03, volatility * 1.8));
  const rr = (target - price) / Math.max(price - stop, 0.0001);
  return { stop, target, rr };
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
    .map((dimension, index) => `${dimension.label} ${(weights[index] / total * 100).toFixed(0)}%`)
    .join(' • ');
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

function entryContext(entry: MessageBase): string {
  const trend = entry.pct !== undefined ? `Δ ${pctFmt(entry.pct)}` : 'Δ —';
  const rvol = entry.rvol !== undefined ? `RVOL ${rvolFmt(entry.rvol)}` : 'RVOL —';
  const bias = entry.assetType === 'stock' ? 'Equity Swing' : 'Crypto Swing';
  return `${bias} | ${trend} | ${rvol}`;
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
