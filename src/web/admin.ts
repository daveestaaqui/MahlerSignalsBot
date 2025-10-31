import express, { Request, Response, Router, NextFunction } from "express";
export function mountAdmin(router: Router, deps: {
  postNow: (opts: { force?: boolean; minScore?: number; dryRun?: boolean }) => Promise<Record<string, any>>;
  postDaily: (opts: { dryRun?: boolean }) => Promise<Record<string, any>>;
  postWeekly: (opts: { dryRun?: boolean }) => Promise<Record<string, any>>;
  testTelegram: () => Promise<Record<string, any>>;
  testDiscord: () => Promise<Record<string, any>>;
  unlock: (opts: { force?: boolean }) => Promise<Record<string, any>>;
}) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
  router.use("/admin", (req: Request, res: Response, next: NextFunction) => {
    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ ok: false });
    next();
  });
  router.post("/admin/unlock", async (req: Request, res: Response) => {
    const force = String(req.query.force || "") === "true";
    const r = await deps.unlock({ force });
    const body: any = { dryRun: !!process.env.DRY_RUN, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
  router.post("/admin/test-telegram", async (_req: Request, res: Response) => {
    const r = await deps.testTelegram();
    const body: any = { dryRun: !!process.env.DRY_RUN, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
  router.post("/admin/test-discord", async (_req: Request, res: Response) => {
    const r = await deps.testDiscord();
    const body: any = { dryRun: !!process.env.DRY_RUN, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
  router.post("/admin/post-now", async (req: Request, res: Response) => {
    const force = String(req.query.force || "") === "true";
    const minScore = Number(req.query.minScore || 0);
    const dryRun = String(process.env.POST_ENABLED||"0")!=="1";
    const r = await deps.postNow({ force, minScore, dryRun });
    const body: any = { dryRun, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
  router.post("/admin/post-daily", async (_req: Request, res: Response) => {
    const dryRun = String(process.env.POST_ENABLED||"0")!=="1";
    const r = await deps.postDaily({ dryRun });
    const body: any = { dryRun, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
  router.post("/admin/post-weekly", async (_req: Request, res: Response) => {
    const dryRun = String(process.env.POST_ENABLED||"0")!=="1";
    const r = await deps.postWeekly({ dryRun });
    const body: any = { dryRun, ...r };
    body.ok = r.ok ?? true;
    res.json(body);
  });
}
