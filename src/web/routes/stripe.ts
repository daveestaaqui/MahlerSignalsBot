import { Router } from "express";
import { RequestWithId, logInfo } from "../../lib/logger";

const router = Router();

router.post("/webhook", (req: RequestWithId, res) => {
  const eventType =
    req.body && typeof req.body.type === "string" ? req.body.type : "unknown";

  logInfo("stripe.webhook.stub", {
    route: "/stripe/webhook",
    eventType,
    hasPayload: Boolean(req.body),
    requestId: req.requestId,
  });

  res.json({ ok: true });
});

export default router;
