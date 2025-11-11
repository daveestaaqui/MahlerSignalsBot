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
  "Aurora-Signals pairs real market + on-chain data with automated risk notes so desks can review high-signal setups quickly.";

const copy = brandCopy as BrandCopy;

export const SHORT_DISCLAIMER: string =
  (copy.disclaimerShort ?? "").trim() || FALLBACK_DISCLAIMER;
export const ABOUT_BLURB: string =
  (copy.aboutBlurb ?? copy.aboutAurora ?? "").trim() || FALLBACK_ABOUT;

export const LEGAL_FOOTER = `${SHORT_DISCLAIMER}

${ABOUT_BLURB}`;

export const CTA_FOOTER =
  "Upgrade to PRO/ELITE for deeper signals plus earlier alerts at https://aurora-signals.onrender.com.";
