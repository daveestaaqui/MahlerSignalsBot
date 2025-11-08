import { Router } from "express";
import fs from "fs";
import path from "path";
const router = Router();
const blogDir = path.join(process.cwd(), "docs/blog");

router.get("/", (_req, res) => {
  const posts = fs.readdirSync(blogDir).filter(f => f.endsWith(".md")).map(f => f.replace(".md",""));
  res.json(posts);
});

router.get("/:slug", (req, res) => {
  const file = path.join(blogDir, `${req.params.slug}.md`);
  if (!fs.existsSync(file)) return res.status(404).send("Post not found");
  res.type("text/markdown").send(fs.readFileSync(file, "utf8"));
});

export default router;
