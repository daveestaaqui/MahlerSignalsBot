import { Router } from "express";
import { logInfo, RequestWithId } from "../../lib/logger";
import { SHORT_DISCLAIMER, ABOUT_BLURB } from "../../lib/legal";

const router = Router();

router.get("/", (req: RequestWithId, res) => {
  const payload = {
    name: "ManySignals",
    baseUrl: process.env.AURORA_BASE_URL || "https://manysignals.finance",
    apiBaseUrl: process.env.BASE_URL || "https://aurora-signals.onrender.com",
    links: {
      status: "/status",
      legal: "/legal",
      blog: "/blog",
      signalsToday: "/signals/today",
      marketingSite: "https://manysignals.finance",
    },
    copy: {
      disclaimerShort: SHORT_DISCLAIMER,
      aboutAurora: ABOUT_BLURB,
    },
  };
  logInfo("config.read", { route: "/config", requestId: req.requestId });
  res.json(payload);
});

export default router;
