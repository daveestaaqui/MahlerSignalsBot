import { Router } from "express";
import fs from "fs";
import path from "path";
import { RequestWithId, logError, logInfo, logWarn } from "../../lib/logger";
import { ABOUT_AURORA, SHORT_DISCLAIMER } from "../../lib/legal";

const router = Router();
const blogDir = path.join(process.cwd(), "docs/blog");

router.get("/", (req: RequestWithId, res) => {
  try {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"));
    const posts = files.map((file) => file.replace(/\.md$/, ""));
    logInfo("blog.index", {
      route: "/blog",
      count: posts.length,
      requestId: req.requestId,
    });
    res.json({ ok: true, posts });
  } catch (error) {
    logError("blog.index_failed", {
      route: "/blog",
      requestId: req.requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    res.status(500).json({ ok: false, error: "blog_unavailable" });
  }
});

router.get("/:slug", (req: RequestWithId, res) => {
  try {
    const filePath = path.join(blogDir, `${req.params.slug}.md`);
    if (!fs.existsSync(filePath)) {
      logWarnNotFound(req, req.params.slug);
      return res.status(404).send("Post not found");
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const content = decoratePost(raw);
    logInfo("blog.read", {
      route: `/blog/${req.params.slug}`,
      requestId: req.requestId,
    });
    res.type("text/markdown").send(content);
  } catch (error) {
    logError("blog.read_failed", {
      route: `/blog/${req.params.slug}`,
      requestId: req.requestId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    res.status(500).json({ ok: false, error: "blog_post_unavailable" });
  }
});

function logWarnNotFound(req: RequestWithId, slug: string): void {
  logWarn("blog.post_not_found", {
    route: `/blog/${slug}`,
    requestId: req.requestId,
  });
}

function decoratePost(markdown: string): string {
  const trimmed = markdown.trimEnd();
  return `${trimmed}

---
${ABOUT_AURORA}

${SHORT_DISCLAIMER}
`;
}

export default router;
