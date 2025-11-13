import { afterAll, describe, expect, it } from "vitest";
import { aboutHandler } from "../../src/web/routes/about";
import { ABOUT_BLURB, SHORT_DISCLAIMER } from "../../src/lib/legal";
import type { RequestWithId } from "../../src/lib/logger";
import { createMockResponse } from "../helpers/mockResponse";

describe("/about handler", () => {
  it("responds with the ManySignals payload and canonical copy", async () => {
    process.env.BASE_URL = "https://aurora.test";
    const req = { requestId: "about-test" } as unknown as RequestWithId;
    const res = createMockResponse();

    await aboutHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: "ManySignals",
      apiBase: "https://aurora.test",
      about: ABOUT_BLURB,
      disclaimer: SHORT_DISCLAIMER,
      marketingSite: "https://manysignals.finance",
    });
    expect(Array.isArray(res.body?.tiers)).toBe(true);
    expect(res.body?.tiers).toHaveLength(3);
  });

  afterAll(() => {
    delete process.env.BASE_URL;
  });
});
