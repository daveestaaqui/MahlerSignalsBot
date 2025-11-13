import { Router, type Response } from "express";
import { buildTodaySignals, type SignalView } from "../../domain/signals";
import { SHORT_DISCLAIMER } from "../../lib/legal";
import { logError, logInfo, type RequestWithId } from "../../lib/logger";

const router = Router();

export type MarketingPreviewPayload = {
  signals: SignalView[];
  updatedAt: string;
  disclaimer: string;
};

export async function marketingPreviewHandler(req: RequestWithId, res: Response) {
  try {
    const signals = await buildTodaySignals();
    const top = signals.slice(0, 3);
    const updatedAt = top[0]?.asOf ?? new Date().toISOString();
    const payload: MarketingPreviewPayload = {
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
    res.status(502).json({
      ok: false,
      error: "marketing_preview_unavailable",
      signals: [],
      updatedAt: new Date().toISOString(),
      disclaimer: SHORT_DISCLAIMER,
    });
  }
}

router.get("/preview", marketingPreviewHandler);

export default router;
