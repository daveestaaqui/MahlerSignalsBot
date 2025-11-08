import { Router } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const router = Router();

router.get('/blog/:slug?', (req, res) => {
  const blogDir = join(__dirname, '../../..', 'docs', 'blog');
  const slug = req.params.slug;
  try {
    if (!slug) {
      const files = readdirSync(blogDir).filter((f) => f.endsWith('.md'));
      res.json({ posts: files.map((f) => f.replace(/\.md$/, '')) });
    } else {
      const mdPath = join(blogDir, `${slug}.md`);
      const content = readFileSync(mdPath, 'utf-8');
      res.type('text/markdown').send(content);
    }
  } catch {
    res.status(404).json({ ok: false, error: 'post not found' });
  }
});

export default router;
