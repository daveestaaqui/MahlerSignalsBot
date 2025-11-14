import { Router, type Response } from "express";
import { ABOUT_BLURB, SHORT_DISCLAIMER } from "../../lib/legal";
import { RequestWithId, logInfo } from "../../lib/logger";

const router = Router();

const DEFAULT_API_BASE = "https://aurora-signals.onrender.com";
const MARKETING_SITE = "https://manysignals.finance";

type Tier = {
  name: string;
  price: string;
  summary: string;
  bestFor: string;
  highlights: string[];
};

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0/mo",
    summary: "Delayed daily briefs with two U.S. equity scenarios for monitoring only.",
    bestFor: "Watchlist lurkers validating format and copy tone.",
    highlights: [
      "US equities only, refreshed after close",
      "Scenario language with expected move ranges",
      "Risk notes and illustrative stop hints",
    ],
  },
  {
    name: "Pro",
    price: "$14/mo",
    summary: "Real-time US equity briefs with full rationales and earlier refreshes.",
    bestFor: "Active desks focused on mega-cap U.S. equities.",
    highlights: [
      "Intraday + next 1–3 day scenarios",
      "Technical + fundamental rationale plus macro note",
      "Stripe checkout + email summaries",
    ],
  },
  {
    name: "Elite",
    price: "$39/mo",
    summary: "Everything in Pro plus ETH/SOL majors and curated L1/L2 coverage.",
    bestFor: "Hybrid desks straddling TradFi equities and majors on Ethereum/Solana.",
    highlights: [
      "Crypto majors (ETH, SOL, BTC, LINK, ARB, OP, more)",
      "On-chain dominance + liquidity context",
      "Priority roadmap feedback loop",
    ],
  },
];

export type AboutPayload = {
  name: string;
  tagline: string;
  about: string;
  tiers: Tier[];
  apiBase: string;
  marketingSite: string;
  disclaimer: string;
};

export function buildAboutPayload(apiBase = process.env.BASE_URL || DEFAULT_API_BASE): AboutPayload {
  return {
    name: "ManySignals Finance",
    tagline:
      "ManySignals Finance delivers daily and weekly scenario-based signals for U.S. equities plus Ethereum and Solana majors, powered by the Aurora Signals engine.",
    about: ABOUT_BLURB,
    tiers: TIERS,
    apiBase,
    marketingSite: MARKETING_SITE,
    disclaimer: SHORT_DISCLAIMER,
  };
}

export function aboutHandler(req: RequestWithId, res: Response) {
  const payload = buildAboutPayload();
  logInfo("about.fetch", {
    route: "/about",
    requestId: req.requestId,
  });
  res.json(payload);
}

router.get("/", aboutHandler);

export default router;
