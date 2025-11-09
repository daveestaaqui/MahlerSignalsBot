import { Router, Response } from "express";
import { log } from "../../lib/log";

type StripeCheckoutParams = {
  mode: "subscription" | "payment";
  line_items: Array<{ price: string; quantity: number }>;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
};

type StripeLike = {
  checkout: {
    sessions: {
      create: (params: StripeCheckoutParams) => Promise<{ id: string; url: string | null }>;
    };
  };
};

type StripeConstructor = new (secret: string, config: { apiVersion: string }) => StripeLike;

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = initializeStripe(stripeSecret);

function initializeStripe(secret?: string | null): StripeLike | null {
  if (!secret) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const StripeLib = require("stripe") as StripeConstructor;
    return new StripeLib(secret, { apiVersion: "2024-06-20" });
  } catch (error) {
    log("warn", "stripe.init_failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
}

function missingConfig(res: Response) {
  return res.status(503).json({ ok: false, error: "stripe_not_configured" });
}

router.post("/stripe/checkout", async (req, res) => {
  if (!stripe) {
    return missingConfig(res);
  }

  const bodyPriceId = typeof req.body?.priceId === "string" ? req.body.priceId.trim() : "";
  const priceId = bodyPriceId || process.env.STRIPE_PRICE_ID_PRO;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  if (!priceId || !successUrl || !cancelUrl) {
    return missingConfig(res);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { source: "aurora-signals" },
    });

    return res.json({ ok: true, sessionId: session.id, url: session.url });
  } catch (error) {
    log("error", "stripe.checkout.failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return res.status(500).json({ ok: false, error: "stripe_error" });
  }
});

router.post("/stripe/webhook", (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return missingConfig(res);
  }

  const eventType =
    req.body && typeof req.body.type === "string" ? req.body.type : "unknown";

  log("info", "stripe.webhook.received", {
    eventType,
    receivedAt: Date.now(),
  });

  return res.json({ ok: true });
});

export default router;
