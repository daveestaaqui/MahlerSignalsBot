import { Router } from "express";
import { buildSampleSignals, SHORT_DISCLAIMER } from "../../domain/signals";

const router = Router();

router.get("/signals/today", (_req, res) => {
  const signals = buildSampleSignals();
  res.json({
    ok: true,
    ts: Date.now(),
    disclaimer: SHORT_DISCLAIMER,
    signals,
  });
});

export default router;
