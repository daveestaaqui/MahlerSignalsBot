import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const blogDir = path.join(process.cwd(), "docs/blog");

router.get("/", (_req, res) => {
  try {
    const files = fs.readdirSync(blogDir).filter(f => f.endsWith(".md"));
    const posts = files.map(f => ({
      slug: f.replace(/\.md$/, ""),
      path: `/blog/${f.replace(/\.md$/, "")}`
    }));
    res.json({ ok: true, posts });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:slug", (req, res) => {
  try {
    const filePath = path.join(blogDir, `${req.params.slug}.md`);
    if (!fs.existsSync(filePath)) return res.status(404).send("Post not found");
    const content = fs.readFileSync(filePath, "utf8");
    res.type("text/markdown").send(content);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
