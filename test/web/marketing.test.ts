import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignalView } from "../../src/domain/signals";
import * as signalsModule from "../../src/domain/signals";
import { marketingPreviewHandler } from "../../src/web/routes/marketing";
import type { RequestWithId } from "../../src/lib/logger";
import { createMockResponse } from "../helpers/mockResponse";
import { SHORT_DISCLAIMER } from "../../src/lib/legal";

describe("/marketing/preview handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the top three signals with updated timestamp", async () => {
    const mockSignals: SignalView[] = Array.from({ length: 5 }).map((_, idx) => ({
      id: `SIG-${idx}`,
      symbol: `SYM${idx}`,
      assetClass: "stock",
      timeframe: "next 1-3 days",
      expectedMove: `Move ${idx}`,
      rationale: { technical: `Tech ${idx}` },
      riskNote: "Risk",
      disclaimer: SHORT_DISCLAIMER,
      dataSources: ["polygon"],
      asOf: `2024-11-0${idx + 1}T00:00:00.000Z`,
    }));

    vi.spyOn(signalsModule, "buildTodaySignals").mockResolvedValue(mockSignals);

    const req = { requestId: "marketing-preview" } as unknown as RequestWithId;
    const res = createMockResponse();

    await marketingPreviewHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.signals).toHaveLength(3);
    expect(res.body?.signals[0]?.symbol).toBe("SYM0");
    expect(res.body?.updatedAt).toBe(mockSignals[0].asOf);
    expect(res.body?.disclaimer).toBe(SHORT_DISCLAIMER);
  });

  it("returns a guarded error payload on failure", async () => {
    vi.spyOn(signalsModule, "buildTodaySignals").mockRejectedValue(new Error("boom"));
    const req = { requestId: "marketing-preview" } as unknown as RequestWithId;
    const res = createMockResponse();

    await marketingPreviewHandler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      ok: false,
      error: "marketing_preview_unavailable",
      disclaimer: SHORT_DISCLAIMER,
    });
  });
});
