import { Router } from 'express';

const router = Router();

const TERMS = `# Aurora Signals — Terms & Disclosures

**Educational only. Not investment advice.** Trading/investing in digital assets is risky. Do your own research. Past performance is not indicative of future results. We may hold positions in assets mentioned. Data may be delayed or inaccurate. We may receive affiliate revenue where disclosed. By using this service you agree we are not your investment advisor.

Jurisdiction: Massachusetts, USA.`;

router.get('/legal', (_req, res) => {
  res.type('text/markdown').send(TERMS);
});

export default router;
