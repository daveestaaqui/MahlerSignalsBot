import Stripe from "stripe";
import { Router, raw, type Request, type Response } from "express";
import { RequestWithId, logError, logInfo, logWarn } from "../../lib/logger";

type Plan = "free" | "pro" | "elite";
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2024-06-20";

const stripeRouter = Router();
const stripeWebhookRouter = Router();

stripeRouter.post("/checkout", async (req: RequestWithId, res: Response) => {
  const plan = normalizePlan(req);
  if (!plan) {
    return res.status(400).json({ ok: false, error: "unsupported_plan" });
  }

  if (plan === "free") {
    logInfo("stripe.checkout.free_tier", { requestId: req.requestId });
    return res.json({ ok: true, message: "Free tier does not require checkout", url: null });
  }

  const config = resolveStripeConfig(plan);
  if (!config.ok) {
    logWarn("stripe.checkout.misconfigured", {
      missing: config.missing,
      plan,
      requestId: req.requestId,
    });
    return res.status(500).json({
      ok: false,
      error: "stripe_not_configured",
      missing: config.missing,
    });
  }

  try {
    const session = await createCheckoutSession(plan, config);
    logInfo("stripe.checkout.created", {
      plan,
      requestId: req.requestId,
    });

    if (!session.url) {
      logError("stripe.checkout.missing_url", { plan, sessionId: session.id, requestId: req.requestId });
      return res.status(502).json({ ok: false, error: "missing_checkout_url" });
    }

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    logError("stripe.checkout.failed", {
      error: describeError(error),
      plan,
      requestId: req.requestId,
    });
    return res.status(502).json({ ok: false, error: "stripe_request_failed" });
  }
});

stripeWebhookRouter.post(
  "/",
  raw({ type: "application/json" }),
  (req: RequestWithId, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logWarn("stripe.webhook.missing_secret", { requestId: req.requestId });
      return res.status(500).json({ ok: false, error: "webhook_secret_missing" });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      logWarn("stripe.webhook.missing_signature", { requestId: req.requestId });
      return res.status(400).json({ ok: false, error: "missing_signature" });
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
    } catch (error) {
      logWarn("stripe.webhook.invalid_signature", {
        error: describeError(error),
        requestId: req.requestId,
      });
      return res.status(400).json({ ok: false, error: "invalid_signature" });
    }

    const object = event.data?.object;
    const customerId = extractCustomerId(object);
    const sessionId = extractSessionId(object);
    logInfo("stripe.webhook.received", {
      type: event.type,
      eventId: event.id,
      customerId,
      sessionId,
      requestId: req.requestId,
    });

    return res.json({ ok: true });
  },
);

export { stripeRouter, stripeWebhookRouter };
export default stripeRouter;

type StripeConfig =
  | {
      ok: true;
      secretKey: string;
      priceId: string;
      successUrl: string;
      cancelUrl: string;
    }
  | {
      ok: false;
      missing: string[];
    };

function normalizePlan(req: Request): Plan | null {
  const rawPlan = readPlanParam(req);
  const normalized = String(rawPlan || "pro").trim().toLowerCase();
  if (normalized === "free") return "free";
  if (normalized === "elite") return "elite";
  if (normalized === "pro") return "pro";
  return null;
}

function readPlanParam(req: Request): string | null {
  const keys = ["tier", "plan"];
  for (const key of keys) {
    const bodyValue = req.body && typeof (req.body as Record<string, unknown>)[key] === "string"
      ? String((req.body as Record<string, unknown>)[key])
      : null;
    if (bodyValue) return bodyValue;
    const queryValue = typeof req.query[key] === "string" ? String(req.query[key]) : null;
    if (queryValue) return queryValue;
  }
  return null;
}

function resolveStripeConfig(plan: Exclude<Plan, "free">): StripeConfig {
  const missing: string[] = [];
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;
  const priceId =
    plan === "elite" ? process.env.STRIPE_PRICE_ELITE : process.env.STRIPE_PRICE_PRO;

  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!successUrl) missing.push("STRIPE_SUCCESS_URL");
  if (!cancelUrl) missing.push("STRIPE_CANCEL_URL");
  if (!priceId) missing.push(plan === "elite" ? "STRIPE_PRICE_ELITE" : "STRIPE_PRICE_PRO");

  if (missing.length) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    secretKey: secretKey!,
    successUrl: successUrl!,
    cancelUrl: cancelUrl!,
    priceId: priceId!,
  };
}

async function createCheckoutSession(
  plan: Exclude<Plan, "free">,
  config: Extract<StripeConfig, { ok: true }>,
): Promise<Stripe.Checkout.Session> {
  const stripe = new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION });
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: config.priceId,
        quantity: 1,
      },
    ],
    success_url: config.successUrl,
    cancel_url: config.cancelUrl,
    metadata: { plan },
    allow_promotion_codes: true,
  });
}

function extractCustomerId(object: Stripe.Event.Data.Object | undefined): string | null {
  if (!object || typeof object !== "object") return null;
  const customerField = (object as { customer?: string | Stripe.Customer }).customer;
  if (!customerField) return null;
  if (typeof customerField === "string") return customerField;
  if (typeof customerField === "object" && customerField !== null && "id" in customerField) {
    const candidate = (customerField as { id?: string }).id;
    return typeof candidate === "string" ? candidate : null;
  }
  return null;
}

function extractSessionId(object: Stripe.Event.Data.Object | undefined): string | null {
  if (!object || typeof object !== "object") return null;
  if ("id" in object && typeof object.id === "string") {
    return object.id;
  }
  return null;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown_error";
}
