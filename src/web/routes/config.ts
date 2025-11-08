import { Router } from "express";
import { PUBLIC_LINKS } from "../../config/publicLinks";
import { STRIPE_PRICING_ENTERPRISE_URL, STRIPE_PRICING_PRO_URL } from "../../config/stripe";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ...PUBLIC_LINKS,
    pricingProUrl: STRIPE_PRICING_PRO_URL,
    pricingEnterpriseUrl: STRIPE_PRICING_ENTERPRISE_URL,
  });
});

export default router;
