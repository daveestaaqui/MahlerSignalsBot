export type DailySummaryOptions = {
  window: "24h" | "7d" | string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function buildNowSummary(): Promise<string> {
  return `🔎 AuroraSignals heartbeat OK — ${nowIso()}`;
}

export async function buildDailySummary(
  options: DailySummaryOptions
): Promise<string> {
  const windowLabel = options.window || "24h";
  return `📊 AuroraSignals summary (${windowLabel}) — ${nowIso()}`;
}
