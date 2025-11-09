import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import { RequestWithId, logError, logInfo } from "../../lib/logger";

const router = Router();

router.get("/", (req: RequestWithId, res) => {
  try {
    const mdPath = join(process.cwd(), "docs", "legal.md");
    const content = readFileSync(mdPath, "utf-8");
    logInfo("legal.read", { route: "/legal", requestId: req.requestId });
    res.type("text/markdown").send(content);
  } catch (error) {
    logError("legal.read_failed", {
      route: "/legal",
      requestId: req.requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    res.status(500).json({ ok: false, error: "legal_unavailable" });
  }
});

export default router;
