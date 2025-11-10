import crypto from "crypto";
import { Router, raw, type Request, type Response } from "express";
import { RequestWithId, logError, logInfo, logWarn } from "../../lib/logger";

type Plan = "free" | "pro" | "elite";

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
      error: "Stripe not configured",
      missing: config.missing,
    });
  }

  try {
    const session = await createCheckoutSession(plan, config);
    logInfo("stripe.checkout.created", {
      plan,
      requestId: req.requestId,
    });

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

    let event: StripeEvent | null = null;
    try {
      event = verifyStripeSignature(req.body as Buffer, signature, webhookSecret);
    } catch (error) {
      logWarn("stripe.webhook.invalid_signature", {
        error: describeError(error),
        requestId: req.requestId,
      });
      return res.status(400).json({ ok: false, error: "invalid_signature" });
    }

    logInfo("stripe.webhook.received", {
      type: event.type,
      id: event.id,
      requestId: req.requestId,
    });

    if (isSubscriptionEvent(event.type)) {
      const payload = {
        customer: event.data?.object?.customer ?? "unknown_customer",
        plan: event.data?.object?.plan?.id ?? "unknown_plan",
        status: event.data?.object?.status ?? "unknown_status",
      };
      logInfo("stripe.subscription.event", {
        requestId: req.requestId,
        event: {
          id: event.id,
          type: event.type,
          ...payload,
        },
      });
    }

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

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: {
      customer?: string;
      status?: string;
      plan?: { id?: string };
    };
  };
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

async function createCheckoutSession(plan: Exclude<Plan, "free">, config: Extract<StripeConfig, { ok: true }>) {
  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("line_items[0][price]", config.priceId);
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", config.successUrl);
  params.append("cancel_url", config.cancelUrl);
  params.append("metadata[plan]", plan);
  params.append("allow_promotion_codes", "true");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`stripe_${response.status}: ${detail.slice(0, 200)}`);
  }

  return response.json() as Promise<{ url: string }>;
}

function verifyStripeSignature(payload: Buffer, header: string, secret: string): StripeEvent {
  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    throw new Error("signature_header_invalid");
  }
  const signedPayload = `${parsed.timestamp}.${payload.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const signatureBuffer = Buffer.from(parsed.v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("signature_mismatch");
  }
  return JSON.parse(payload.toString("utf8"));
}

function parseSignatureHeader(header: string): { timestamp: string; v1: string } | null {
  const parts = header.split(",");
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const v1Part = parts.find((part) => part.startsWith("v1="));
  if (!timestampPart || !v1Part) return null;
  return {
    timestamp: timestampPart.split("=", 2)[1] ?? "",
    v1: v1Part.split("=", 2)[1] ?? "",
  };
}

function isSubscriptionEvent(type: string): boolean {
  return [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ].includes(type);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown_error";
}
