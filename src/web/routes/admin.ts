import { Router, Request, Response, NextFunction } from "express";
const r = Router();
const guard = (req: Request, res: Response, next: NextFunction) => {
  const want = `Bearer ${process.env.ADMIN_TOKEN||""}`;
  const got = req.headers.authorization||"";
  if (!process.env.ADMIN_TOKEN || got !== want) return res.status(401).json({ ok:false, error:"unauthorized" });
  next();
};
const ok = (_req: Request, res: Response) => res.status(204).end();
r.use(guard);
r.post("/post-now", ok);
r.post("/post-daily", ok);
r.post("/post-weekly", ok);
r.post("/test-telegram", ok);
r.post("/test-discord", ok);
export default r;