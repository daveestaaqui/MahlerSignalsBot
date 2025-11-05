import type { Request, Response } from "express";
import crypto from "crypto";

export default function stripeHandler(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

  try {
    const bodyBuffer = req.body as Buffer;
    const bodyText = bodyBuffer?.toString("utf8") || "";
    const type = (() => {
      try {
        return JSON.parse(bodyText || "{}")?.type || "unknown";
      } catch {
        return "unknown";
      }
    })();

    if (!secret) {
      return res.status(200).json({ received: true, type, dev: true });
    }

    const sigHeader = req.header("Stripe-Signature") || "";
    const hmac = crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
    const v1 =
      sigHeader
        .split(",")
        .map((part) => part.trim())
        .find((part) => part.startsWith("v1="))
        ?.slice(3) || "";

    if (!v1 || !crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(hmac))) {
      return res.status(400).json({ error: "bad signature" });
    }

    return res.status(200).json({ received: true, type });
  } catch {
    return res.status(400).json({ error: "verification error" });
  }
}
