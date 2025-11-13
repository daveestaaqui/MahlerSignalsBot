import { Router, type Response } from "express";
import { RequestWithId, logInfo } from "../../lib/logger";
import { SHORT_DISCLAIMER } from "../../lib/legal";

const router = Router();
const DEFAULT_API_BASE = "https://aurora-signals.onrender.com";

const PUBLIC_ENDPOINTS = [
  "/status",
  "/healthz",
  "/metrics",
  "/metrics/weekly",
  "/config",
  "/signals/today",
  "/blog",
  "/blog/:slug",
  "/about",
  "/legal",
  "/diagnostics",
  "/marketing/preview",
];

type DiagnosticsPayload = {
  ok: true;
  version: string;
  env: string;
  apiBase: string;
  time: string;
  publicEndpoints: string[];
  disclaimer: string;
};

export function buildDiagnosticsPayload(now = new Date()): DiagnosticsPayload {
  return {
    ok: true,
    version: resolveVersion(),
    env: process.env.NODE_ENV || "development",
    apiBase: process.env.BASE_URL || DEFAULT_API_BASE,
    time: now.toISOString(),
    publicEndpoints: PUBLIC_ENDPOINTS,
    disclaimer: SHORT_DISCLAIMER,
  };
}

export function diagnosticsHandler(req: RequestWithId, res: Response) {
  const payload = buildDiagnosticsPayload();

  logInfo("diagnostics.fetch", {
    route: "/diagnostics",
    requestId: req.requestId,
  });

  res.json(payload);
}

router.get("/", diagnosticsHandler);

export default router;
export { PUBLIC_ENDPOINTS, DiagnosticsPayload };

function resolveVersion(): string {
  return process.env.AURORA_VERSION || process.env.npm_package_version || "0.0.0";
}
