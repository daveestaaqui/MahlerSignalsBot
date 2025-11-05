import crypto from "node:crypto";
import { Request, Response } from "express";
import { log } from "../../lib/log";

const processedEvents = new Set<string>();

const parseSignature = (header: string | string[] | undefined) => {
  if (!header) {
    return undefined;
  }
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    return undefined;
  }
  const parts = raw.split(",").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith("v1=")) {
      return part.slice(3);
    }
  }
  return raw;
};

export default function stripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    log("error", "stripe secret missing");
    return res.status(500).json({ error: "misconfigured" });
  }

  const providedSignature = parseSignature(req.headers["stripe-signature"]);
  if (!providedSignature) {
    log("warn", "stripe signature missing");
    return res.status(400).json({ error: "missing signature" });
  }

  const raw = (req as any)._raw as Buffer | undefined;
  if (!raw || !Buffer.isBuffer(raw)) {
    log("warn", "stripe raw body missing");
    return res.status(400).json({ error: "missing raw body" });
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const normalizedProvided = providedSignature.toLowerCase();
  const normalizedExpected = expectedSignature.toLowerCase();
  const signaturesMatch =
    normalizedExpected.length === normalizedProvided.length &&
    crypto.timingSafeEqual(
      Buffer.from(normalizedExpected),
      Buffer.from(normalizedProvided)
    );

  if (!signaturesMatch) {
    log("warn", "stripe signature mismatch");
    return res.status(400).json({ error: "bad signature" });
  }

  const payload = (req.body as { type?: string; id?: string } | undefined) || {};
  const type = payload.type || "unknown";
  const id = payload.id;

  if (id) {
    if (processedEvents.has(id)) {
      log("info", "stripe duplicate event", { id, type });
      return res.status(200).json({ received: true, type, duplicate: true });
    }
    processedEvents.add(id);
  }

  log("info", "stripe webhook received", { id, type });
  return res.status(200).json({ received: true, type });
}
