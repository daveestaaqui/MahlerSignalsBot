// Legal disclaimers and CTA footer constants
import brandCopy from "../../branding/copy.json" assert { type: "json" };

type BrandCopy = {
  disclaimerShort: string;
  aboutAurora: string;
};

const copy = brandCopy as BrandCopy;

export const SHORT_DISCLAIMER: string = copy.disclaimerShort;
export const ABOUT_AURORA: string = copy.aboutAurora;

export const LEGAL_FOOTER = `${SHORT_DISCLAIMER}

${ABOUT_AURORA}`;

export const CTA_FOOTER =
  "Upgrade to PRO/ELITE for deeper signals plus earlier alerts at https://aurora-signals.onrender.com.";
