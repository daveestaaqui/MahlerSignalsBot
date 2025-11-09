import { Router } from "express";
import { buildIllustrativeTodaySignals } from "../../domain/signals";

const router = Router();

router.get("/signals/today", (_req, res) => {
  const payload = buildIllustrativeTodaySignals();
  res.json(payload);
});

export default router;
