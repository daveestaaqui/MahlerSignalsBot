import type { Request, Response, NextFunction } from "express";

export function requireBearer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const expected = process.env.ADMIN_TOKEN || "";
  const auth = req.headers.authorization || "";

  if (!expected || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const token = auth.slice("Bearer ".length);
  if (token !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  return next();
}
