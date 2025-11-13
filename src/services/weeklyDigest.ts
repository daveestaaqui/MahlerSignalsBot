import { generateWeeklySummary, type WeeklySummary } from './weeklySummary';
import { formatWeeklyDigestMessage, type FormattedMessage } from './formatters';

export type WeeklyDigestPayload = {
  summary: WeeklySummary;
  message: FormattedMessage;
};

export function buildWeeklyDigest(): WeeklyDigestPayload {
  const summary = generateWeeklySummary();
  const winners = formatLeaders(summary.topWinners.slice(0, 5));
  const losers = formatLeaders(summary.topLosers.slice(0, 5));
  const leaderboard = formatLeaderboard(summary.entries);
  const message = formatWeeklyDigestMessage({
    header: 'ManySignals • Weekly Performance Digest',
    bullets: [
      `Signals sent: ${summary.count}`,
      `Win rate (5d): ${summary.winRate5d !== null ? `${(summary.winRate5d * 100).toFixed(1)}%` : '—'}`,
      `Avg score: ${summary.avgScore ?? '—'} • Median score: ${summary.medianScore ?? '—'}`,
      `Top winners: ${winners}`,
      `Drawdowns to review: ${losers}`,
      `Leaderboard (5d): ${leaderboard}`,
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

function formatLeaderboard(entries: WeeklySummary['entries']): string {
  if (!entries.length) return '—';
  return entries
    .filter((item) => typeof item.pnl5d === 'number')
    .sort((a, b) => (b.pnl5d ?? 0) - (a.pnl5d ?? 0))
    .slice(0, 5)
    .map((item) => `${item.ticker} ${formatPct(item.pnl5d ?? 0)}`)
    .join(' • ');
}
