import { Router } from "express";
import { publicLinks } from "../../config/publicLinks";

const router = Router();

router.get("/config/public", (_req, res) => {
  res.json({
    ok: true,
    links: publicLinks,
  });
});

export default router;
