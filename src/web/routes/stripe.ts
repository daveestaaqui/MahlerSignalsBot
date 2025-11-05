import { Request, Response } from "express";

export default function stripeWebhook(req: Request, res: Response) {
  const type = (req.body as { type?: string } | undefined)?.type || "unknown";
  res.status(200).json({ received: true, type });
}
