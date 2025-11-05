import type { Request, Response } from "express";
import { Router } from "express";

const r = Router();

r.post("/post-now", (_req: Request, res: Response) => res.status(204).end());
r.post("/post-daily", (_req: Request, res: Response) => res.status(204).end());
r.post("/post-weekly", (_req: Request, res: Response) => res.status(204).end());
r.post("/test-telegram", (_req: Request, res: Response) => res.status(204).end());
r.post("/test-discord", (_req: Request, res: Response) => res.status(204).end());
r.get("/self-check", (_req, res) => res.json({ ok: true }));

export default r;
