// Legal disclaimers and CTA footer constants
import brandCopy from "../../branding/copy.json";

type BrandCopy = {
  disclaimerShort?: string;
  aboutAurora?: string;
  aboutBlurb?: string;
};

const FALLBACK_DISCLAIMER =
  "This system provides automated market analysis for informational purposes only and does not constitute personalized financial, investment, or trading advice.";
const FALLBACK_ABOUT =
  "ManySignals pairs Polygon equities data with CoinGecko on-chain context to publish scenario-based briefs that stay conservative by default.";

const copy = brandCopy as BrandCopy;

export const SHORT_DISCLAIMER: string =
  (copy.disclaimerShort ?? "").trim() || FALLBACK_DISCLAIMER;
export const ABOUT_BLURB: string =
  (copy.aboutBlurb ?? copy.aboutAurora ?? "").trim() || FALLBACK_ABOUT;

export const LEGAL_FOOTER = `${SHORT_DISCLAIMER}

${ABOUT_BLURB}`;

export const CTA_FOOTER =
  "Upgrade to PRO/ELITE for deeper signals plus earlier alerts at https://manysignals.finance.";
