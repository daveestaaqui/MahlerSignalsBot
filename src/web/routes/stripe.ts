import { Request, Response } from 'express';
export default function stripeWebhook(req: Request, res: Response) {
  const t = (req.body && (req.body as any).type) || 'unknown';
  res.status(200).json({ received: true, type: t });
}
