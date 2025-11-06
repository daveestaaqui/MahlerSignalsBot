import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  const now = Date.now();
  res.json({
    ok: true,
    ts: now,
    version: process.env.npm_package_version || '0.0.0'
  });
});

export default router;
