import { Router } from "express";
import { RequestWithId, logInfo } from "../../lib/logger";

const router = Router();

router.get("/", (req: RequestWithId, res) => {
  const now = Date.now();
  const payload = {
    ok: true,
    ts: now,
    version: process.env.npm_package_version || "0.0.0",
  };
  logInfo("metrics.fetch", { route: "/metrics", requestId: req.requestId });
  res.json(payload);
});

export default router;
