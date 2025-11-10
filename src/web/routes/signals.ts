import { Router, type Request, type Response } from "express";
import { buildTodaySignals, type SignalView } from "../../domain/signals";
import { logInfo } from "../../lib/logger";

const router = Router();

router.get("/today", (_req: Request, res: Response) => {
  const signals: SignalView[] = buildTodaySignals();
  logInfo("GET /signals/today", { count: signals.length });
  res.json(signals);
});

export default router;
