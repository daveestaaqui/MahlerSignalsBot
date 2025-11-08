import { Request, Response, NextFunction } from "express";

export function requireBearer(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const token = header.slice(7);
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  next();
}
