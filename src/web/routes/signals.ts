import { Router } from "express";
import { buildTodaySignals } from "../../domain/signals";
import { RequestWithId, logInfo } from "../../lib/logger";

const router = Router();

router.get("/today", (req: RequestWithId, res) => {
  const payload = buildTodaySignals();
  logInfo("signals.today", {
    route: "/signals/today",
    count: payload.signals.length,
    requestId: req.requestId,
  });
  res.json(payload);
});

export default router;
