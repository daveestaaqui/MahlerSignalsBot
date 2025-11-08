import type { Request, Response } from "express";
import crypto from "crypto";
import { handleMembershipWebhook } from "../../services/membership";
import { log } from "../../lib/log";

type VerificationResult = {
  valid: boolean;
  reason?: string;
  timestamp?: string;
};

const MEMBERSHIP_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
]);

export default async function stripeHandler(
  req: Request,
  res: Response
): Promise<Response> {
  const rawBody = getRawBody(req);
  if (!rawBody) {
    return res.status(400).json({ error: "missing_body" });
  }

  let event: Record<string, unknown>;
  try {
    const text = rawBody.toString("utf8") || "{}";
    event = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    log("warn", "stripe webhook invalid json", { error: describeError(error) });
    return res.status(400).json({ error: "invalid_json" });
  }

  const type = typeof event.type === "string" ? event.type : "unknown";
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const signature = req.header("Stripe-Signature") || "";

  if (secret) {
    const verification = verifySignature(rawBody, signature, secret);
    if (!verification.valid) {
      log("warn", "stripe signature mismatch", {
        type,
        reason: verification.reason ?? "mismatch",
        timestamp: verification.timestamp,
      });
      return res.status(400).json({ error: "bad signature" });
    }
  } else {
    log("warn", "stripe webhook secret missing", { type });
  }

  if (MEMBERSHIP_EVENT_TYPES.has(type)) {
    await handleMembershipWebhook({
      type,
      data: {
        object:
          (event?.data as { object?: Record<string, unknown> } | undefined)
            ?.object ?? {},
      },
    });
  }

  return res.status(200).json({ received: true, type });
}

function getRawBody(req: Request): Buffer | null {
  const body = req.body;
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  return null;
}

function verifySignature(
  payload: Buffer,
  signatureHeader: string,
  secret: string
): VerificationResult {
  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature" };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.v1) {
    return { valid: false, reason: "missing_v1", timestamp: parsed.t };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const actual = Buffer.from(parsed.v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (
    actual.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actual, expectedBuffer)
  ) {
    return { valid: false, reason: "mismatch", timestamp: parsed.t };
  }

  return { valid: true, timestamp: parsed.t };
}

function parseSignatureHeader(header: string): { t?: string; v1?: string } {
  const result: { t?: string; v1?: string } = {};
  const parts = header.split(",").map((part) => part.trim());

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) {
      continue;
    }
    if (key === "t") {
      result.t = value;
    }
    if (key === "v1") {
      result.v1 = value;
    }
  }

  return result;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown_error";
}
