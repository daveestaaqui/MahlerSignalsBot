import { Router, type Response } from "express";
import { buildTodaySignals, type SignalView } from "../../domain/signals";
import { logError, logInfo, type RequestWithId } from "../../lib/logger";

const router = Router();

export async function signalsTodayHandler(req: RequestWithId, res: Response) {
  try {
    const signals: SignalView[] = await buildTodaySignals();
    logInfo("signals.today.ok", { count: signals.length, requestId: req.requestId });
    res.json(signals);
  } catch (error) {
    logError("signals.today.failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      requestId: req.requestId,
    });
    res.status(502).json({ ok: false, error: "signals_unavailable" });
  }
}

router.get("/today", signalsTodayHandler);

export default router;
