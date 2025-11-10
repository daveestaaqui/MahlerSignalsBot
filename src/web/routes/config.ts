import { Router } from "express";
import { logInfo, RequestWithId } from "../../lib/logger";
import { SHORT_DISCLAIMER, ABOUT_AURORA } from "../../lib/legal";

const router = Router();

router.get("/", (req: RequestWithId, res) => {
  const payload = {
    name: "Aurora-Signals",
    baseUrl: process.env.AURORA_BASE_URL || "https://aurora-signals.onrender.com",
    links: {
      status: "/status",
      legal: "/legal",
      blog: "/blog",
      signalsToday: "/signals/today",
      marketingSite: "/",
    },
    copy: {
      disclaimerShort: SHORT_DISCLAIMER,
      aboutAurora: ABOUT_AURORA,
    },
  };
  logInfo("config.read", { route: "/config", requestId: req.requestId });
  res.json(payload);
});

export default router;
