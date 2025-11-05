import type { Request, Response } from "express";
import crypto from "node:crypto";

const text = (payload: Buffer | unknown) => {
  if (Buffer.isBuffer(payload)) return payload.toString("utf8");
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return "";
  }
};

export default function stripeHandler(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const sigHeader = (req.headers["stripe-signature"] as string) || "";

  const raw = req.body as unknown as Buffer;
  const bodyStr = text(raw);

  const type = (() => {
    try {
      const parsed = JSON.parse(bodyStr || "{}");
      return parsed?.type || "unknown";
    } catch {
      return "unknown";
    }
  })();

  if (!secret || !sigHeader) {
    if (type === "ping") {
      return res.status(200).json({ received: true, type });
    }
    return res
      .status(200)
      .json({ received: true, type, note: "signature bypass (dev)" });
  }

  try {
    const hmac = crypto.createHmac("sha256", secret).update(bodyStr).digest("hex");
    const v1 = sigHeader
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.startsWith("v1="))
      ?.slice(3);

    if (!v1) {
      return res.status(400).json({ error: "bad signature" });
    }

    if (!crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(hmac))) {
      return res.status(400).json({ error: "bad signature" });
    }

    return res.status(200).json({ received: true, type });
  } catch {
    return res.status(400).json({ error: "verification error" });
  }
}
