import { Router, type Response } from "express";
import { buildTodaySignals, type SignalView } from "../../domain/signals";
import { SHORT_DISCLAIMER } from "../../lib/legal";
import { logError, logInfo, type RequestWithId } from "../../lib/logger";

const router = Router();

export type MarketingPreviewSuccess = {
  ok: true;
  signals: SignalView[];
  updatedAt: string;
  disclaimer: string;
};

export type MarketingPreviewFailure = {
  ok: false;
  error: string;
  updatedAt: string;
  disclaimer: string;
};

export type MarketingPreviewPayload = MarketingPreviewSuccess | MarketingPreviewFailure;

export async function marketingPreviewHandler(req: RequestWithId, res: Response) {
  try {
    const signals = await buildTodaySignals();
    const top = signals.slice(0, 3);
    const updatedAt = top[0]?.asOf ?? new Date().toISOString();
    const payload: MarketingPreviewPayload = {
      ok: true,
      signals: top,
      updatedAt,
      disclaimer: SHORT_DISCLAIMER,
    };
    logInfo("marketing.preview.ok", {
      route: "/marketing/preview",
      count: top.length,
      requestId: req.requestId,
    });
    res.json(payload);
  } catch (error) {
    logError("marketing.preview.failed", {
      route: "/marketing/preview",
      error: error instanceof Error ? error.message : "unknown_error",
      requestId: req.requestId,
    });
    const failurePayload: MarketingPreviewPayload = {
      ok: false,
      error: "marketing_preview_unavailable",
      updatedAt: new Date().toISOString(),
      disclaimer: SHORT_DISCLAIMER,
    };
    res.status(502).json(failurePayload);
  }
}

router.get("/preview", marketingPreviewHandler);

export default router;
