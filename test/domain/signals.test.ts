import { describe, expect, it } from "vitest";
import { buildSignalView } from "../../src/domain/signals";
import { SHORT_DISCLAIMER } from "../../src/lib/legal";

describe("buildSignalView", () => {
  it("constructs the rich SignalView contract", () => {
    const asOf = new Date("2024-10-01T12:00:00Z");
    const view = buildSignalView({
      symbol: "NVDA",
      assetClass: "stock",
      timeframe: "next 1-3 days",
      move: { min: -2.5, max: 4.5, bias: "bullish" },
      stopLossPct: 0.035,
      technical: "Range break confirmed with volume surge",
      macro: "CPI print later this week",
      riskNote: "Liquidity thins into the close",
      dataSources: ["polygon", "coingecko"],
      asOf,
    });

    expect(view.id).toContain("NVDA-next-1-3-days-2024-10-01T12:00:00.000Z");
    expect(view.symbol).toBe("NVDA");
    expect(view.expectedMove).toContain("NVDA next 1-3 days scenario");
    expect(view.expectedMove).toContain("constructive move");
    expect(view.stopLossHint).toContain("Illustrative stop");
    expect(view.rationale.technical).toBe("Range break confirmed with volume surge");
    expect(view.rationale.macro).toBe("CPI print later this week");
    expect(view.disclaimer).toBe(SHORT_DISCLAIMER);
    expect(view.dataSources).toEqual(["polygon", "coingecko"]);
    expect(view.asOf).toBe(asOf.toISOString());
  });
});
