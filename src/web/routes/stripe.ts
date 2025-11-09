import { Router } from "express";
// @ts-expect-error Stripe types are not installed in this local sandbox.
import Stripe from "stripe";
import { log } from "../../lib/log";

const router = Router();
const STRIPE_API_VERSION = "2024-06-20";

type CheckoutRequest = {
  mode?: string;
};

type StripeClient = InstanceType<typeof Stripe>;
let stripeClient: StripeClient | null = null;

router.post("/billing/checkout", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ ok: false, error: "stripe_not_configured" });
  }

  const body: CheckoutRequest = req.body ?? {};
  if (body.mode && body.mode !== "pro") {
    return res.status(400).json({ ok: false, error: "unsupported_mode" });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  if (!priceId || !successUrl || !cancelUrl) {
    return res.status(503).json({ ok: false, error: "stripe_not_configured" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    });

    if (!session.url) {
      throw new Error("missing_checkout_url");
    }

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    log("error", "stripe.checkout_error", { error: describeError(error) });
    return res.status(500).json({ ok: false, error: "stripe_error" });
  }
});

export default router;

function getStripe(): StripeClient {
  if (stripeClient) {
    return stripeClient;
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("stripe_not_configured");
  }
  stripeClient = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown_error";
}
