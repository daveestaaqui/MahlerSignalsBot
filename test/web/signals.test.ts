import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignalView } from "../../src/domain/signals";
import { signalsTodayHandler } from "../../src/web/routes/signals";
import * as signalsModule from "../../src/domain/signals";
import type { RequestWithId } from "../../src/lib/logger";
import { createMockResponse } from "../helpers/mockResponse";
import { SHORT_DISCLAIMER } from "../../src/lib/legal";

describe("/signals/today handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns live SignalView data from the domain layer", async () => {
    const mockSignals: SignalView[] = [
      {
        id: "SPY-next-1-3-days-2024-10-01T00:00:00.000Z",
        symbol: "SPY",
        assetClass: "stock",
        timeframe: "next 1-3 days",
        expectedMove: "SPY scenario",
        stopLossHint: "Illustrative stop",
        rationale: { technical: "Range breakout", macro: "FOMC upcoming" },
        riskNote: "Liquidity thinning",
        disclaimer: SHORT_DISCLAIMER,
        dataSources: ["polygon"],
        asOf: "2024-10-01T00:00:00.000Z",
      },
    ];

    const spy = vi.spyOn(signalsModule, "buildTodaySignals").mockResolvedValue(mockSignals);
    const req = { requestId: "signals-test" } as unknown as RequestWithId;
    const res = createMockResponse<SignalView[]>();

    await signalsTodayHandler(req, res);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockSignals);
  });

  it("guards against upstream failures", async () => {
    vi.spyOn(signalsModule, "buildTodaySignals").mockRejectedValue(new Error("boom"));
    const req = { requestId: "signals-test" } as unknown as RequestWithId;
    const res = createMockResponse();

    await signalsTodayHandler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "signals_unavailable" });
  });
});
