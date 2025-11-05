import { Router, Request, Response, NextFunction } from "express";

const router = Router();

const guard = (req: Request, res: Response, next: NextFunction) => {
  const expectedToken = process.env.ADMIN_TOKEN ?? "";
  const expectedHeader = `Bearer ${expectedToken}`;
  if (req.headers.authorization !== expectedHeader) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
};

const respondNoContent = (_req: Request, res: Response) => res.sendStatus(204);

router.use(guard);
router.post("/post-now", respondNoContent);
router.post("/post-daily", respondNoContent);
router.post("/post-weekly", respondNoContent);
router.post("/test-telegram", respondNoContent);
router.post("/test-discord", respondNoContent);

export default router;
