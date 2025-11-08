import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

router.get("/", (_req, res) => {
  try {
    const mdPath = join(__dirname, "../../..", "docs", "legal.md");
    const content = readFileSync(mdPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch {
    res.status(500).json({ ok: false, error: "legal file not found" });
  }
});

export default router;
