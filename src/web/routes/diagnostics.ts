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

const KEY_ENDPOINTS = [
  {
    id: "status",
    path: "/status",
    description: "Service heartbeat for Render health checks.",
  },
  {
    id: "signalsToday",
    path: "/signals/today",
    description: "Live highlights consumed by Hostinger.",
  },
  {
    id: "marketingPreview",
    path: "/marketing/preview",
    description: "Top-of-day hero copy for ManySignals Finance.",
  },
];

type EndpointSummary = {
  id: string;
  path: string;
  description: string;
  url: string;
  status: "not_checked" | "ok" | "error";
};

type DiagnosticsPayload = {
  ok: true;
  version: string;
  env: string;
  apiBase: string;
  configuredBaseUrl?: string | null;
  time: string;
  publicEndpoints: string[];
  keyEndpoints: EndpointSummary[];
  disclaimer: string;
};

export function buildDiagnosticsPayload(now = new Date()): DiagnosticsPayload {
  const configuredBaseUrl =
    process.env.BASE_URL?.trim() ||
    process.env.AURORA_BASE_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    null;
  const apiBase = (configuredBaseUrl || DEFAULT_API_BASE).replace(/\/$/, "");
  return {
    ok: true,
    version: resolveVersion(),
    env: process.env.NODE_ENV || "development",
    apiBase,
    configuredBaseUrl,
    time: now.toISOString(),
    publicEndpoints: PUBLIC_ENDPOINTS,
    keyEndpoints: KEY_ENDPOINTS.map((entry) => ({
      ...entry,
      url: `${apiBase}${entry.path}`,
      status: "not_checked",
    })),
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
