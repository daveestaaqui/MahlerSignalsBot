import express, { Request, Response, NextFunction } from "express";

type Deps = {
  postNow: (opts:any)=>Promise<any>,
  postDaily: (opts:any)=>Promise<any>,
  postWeekly: (opts:any)=>Promise<any>,
  testTelegram: ()=>Promise<any>,
  testDiscord: ()=>Promise<any>,
  unlock: (opts:any)=>Promise<any>,
};

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token !== (process.env.ADMIN_TOKEN || "")) {
    res.status(401).json({ ok:false, error:"unauthorized" });
    return;
  }
  next();
}

export default function mountAdmin(app: express.Express, deps: Deps) {
  const router = express.Router();
  router.use(requireAdmin);

  router.post("/unlock", async (_req: Request, res: Response) => {
    const r = await deps.unlock({ force:true });
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  router.post("/test-telegram", async (_req: Request, res: Response) => {
    const r = await deps.testTelegram();
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  router.post("/test-discord", async (_req: Request, res: Response) => {
    const r = await deps.testDiscord();
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  router.post("/post-now", async (req: Request, res: Response) => {
    const force = String(req.query.force||"") === "true";
    const minScore = Number(req.query.minScore||0);
    const r = await deps.postNow({ force, minScore, dryRun: String(process.env.POST_ENABLED||"0")!=="1" });
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  router.post("/post-daily", async (_req: Request, res: Response) => {
    const r = await deps.postDaily({ dryRun: String(process.env.POST_ENABLED||"0")!=="1" });
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  router.post("/post-weekly", async (_req: Request, res: Response) => {
    const r = await deps.postWeekly({ dryRun: String(process.env.POST_ENABLED||"0")!=="1" });
    res.json({ ok:true, dryRun: String(process.env.POST_ENABLED||"0")!=="1", ...r });
  });

  app.use("/admin", router);
}
