import { generateWeeklySummary, type WeeklySummary } from './weeklySummary.js';
import { formatWeeklyDigestMessage, type FormattedMessage } from './formatters.js';

export type WeeklyDigestPayload = {
  summary: WeeklySummary;
  message: FormattedMessage;
};

export function buildWeeklyDigest(): WeeklyDigestPayload {
  const summary = generateWeeklySummary();
  const message = formatWeeklyDigestMessage({
    header: 'AuroraSignalX • Weekly Performance Digest',
    bullets: [
      `Signals sent: ${summary.count}`,
      `Win rate (5d): ${summary.winRate5d !== null ? `${(summary.winRate5d * 100).toFixed(1)}%` : '—'}`,
      `Avg score: ${summary.avgScore ?? '—'} • Median score: ${summary.medianScore ?? '—'}`,
      `Top winners: ${formatLeaders(summary.topWinners)}`,
      `Drawdowns to review: ${formatLeaders(summary.topLosers)}`,
    ],
    cta: 'CTA: Review fills, tighten playbooks, and prep for Monday open.',
  });
  return { summary, message };
}

function formatLeaders(rows: Array<{ symbol: string; tier: string; pnl: number }>): string {
  if (!rows.length) return '—';
  return rows
    .map((row) => `${row.symbol} ${formatPct(row.pnl)}`)
    .join(' • ');
}

function formatPct(value: number) {
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
