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
};

type Bundle = {
  tier: Tier;
  asset: AssetClass;
  entries: MessageBase[];
};

const tierMeta = {
  elite: { emoji: '👑', risk: 'Risk: Cap size ≤1.0R, trail once +1R locked.' },
  pro: { emoji: '⭐', risk: 'Risk: Size ≤0.75R, stop at swing low/high.' },
  free: { emoji: '⌛', risk: 'Upgrade for realtime entries, stops, and targets.' },
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
    return { telegram: fallback, plain: fallback };
  }

  const body: string[] = [];
  entries.forEach((entry) => {
    const plan = buildPlan(entry);
    const breakdown = conviction(entry.subs);
    body.push(
      `• <b>${escapeHtml(entry.symbol)}</b> | Entry ${priceFmt(entry.price)} | Δ ${pctFmt(entry.pct)} | RVOL ${rvolFmt(entry.rvol)} | Score ${scoreFmt(entry.score)}`,
    );
    body.push(
      `  Plan: Stop ${priceFmt(plan.stop)} | TP ${priceFmt(plan.target)} | R:R ${rrFmt(plan.rr)} | Bias ${capitalize(entry.assetType)}`,
    );
    body.push(`  Conviction: ${escapeHtml(breakdown)}${entry.reason ? ` | Note: ${escapeHtml(entry.reason)}` : ''}`);
  });

  body.push(tierMeta[tier].risk);

  const telegram = [headerLine(tier, asset), ...body].join('\n');
  const plain = stripHtml(telegram);
  return { telegram, plain };
}

function headerLine(tier: Tier, asset: AssetClass): string {
  const meta = tierMeta[tier];
  const assetLabel = asset === 'stock' ? 'Stocks' : 'Crypto';
  return `${meta.emoji} ${tier.toUpperCase()} • ${assetLabel}`;
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
  const parts: string[] = [];
  const keys: Array<[string, string]> = [
    ['tech', 'Tech'],
    ['whale', 'Whale'],
    ['sentiment', 'Sent'],
    ['options', 'Opt'],
    ['fundamental', 'Fund'],
  ];
  keys.forEach(([key, label]) => {
    const val = subs?.[key] ?? 0;
    parts.push(`${label} ${Math.round(val * 100)}`);
  });
  return parts.join(' • ');
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

function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}
