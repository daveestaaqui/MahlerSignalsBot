import { Router } from "express";
import { RequestWithId, logError, logInfo } from "../../lib/logger";
import { generateWeeklySummary } from "../../services/weeklySummary";

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

router.get("/weekly", (req: RequestWithId, res) => {
  try {
    const summary = generateWeeklySummary();
    logInfo("metrics.weekly", {
      route: "/metrics/weekly",
      requestId: req.requestId,
      count: summary.count,
    });
    res.json({ ok: true, summary });
  } catch (error) {
    logError("metrics.weekly_failed", {
      route: "/metrics/weekly",
      requestId: req.requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    res.status(500).json({ ok: false, error: "weekly_summary_unavailable" });
  }
});

export default router;
