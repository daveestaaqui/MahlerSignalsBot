import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDiagnosticsPayload, diagnosticsHandler, PUBLIC_ENDPOINTS } from "../../src/web/routes/diagnostics";
import type { RequestWithId } from "../../src/lib/logger";
import { createMockResponse } from "../helpers/mockResponse";
import { SHORT_DISCLAIMER } from "../../src/lib/legal";

describe("/diagnostics handler", () => {
  beforeAll(() => {
    process.env.BASE_URL = "https://aurora.test";
    process.env.NODE_ENV = "test";
    process.env.AURORA_VERSION = "9.9.9-test";
  });

  it("builds the documented diagnostics payload", () => {
    const now = new Date("2024-11-01T00:00:00.000Z");
    const payload = buildDiagnosticsPayload(now);

    expect(payload).toMatchObject({
      ok: true,
      version: "9.9.9-test",
      env: "test",
      apiBase: "https://aurora.test",
      time: now.toISOString(),
      disclaimer: SHORT_DISCLAIMER,
    });
    expect(payload.publicEndpoints).toEqual(PUBLIC_ENDPOINTS);
  });

  it("invokes the handler and responds with JSON", async () => {
    const req = { requestId: "diag-test" } as unknown as RequestWithId;
    const res = createMockResponse();

    await diagnosticsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
    expect(res.body).toHaveProperty("publicEndpoints", PUBLIC_ENDPOINTS);
  });

  afterAll(() => {
    delete process.env.BASE_URL;
    delete process.env.NODE_ENV;
    delete process.env.AURORA_VERSION;
  });
});
