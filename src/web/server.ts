import path from "path";
import express from "express";
import adminRouter from "./routes/admin";
import metricsRouter from "./routes/metrics";
import blogRouter from "./routes/blog";
import legalRouter from "./routes/legal";
import signalsRouter from "./routes/signals";
import stripeRouter, { stripeWebhookRouter } from "./routes/stripe";
import configRouter from "./routes/config";
import { requireBearer } from "../lib/auth";
import { attachRequestId } from "../lib/logger";

const app = express();
app.use(attachRequestId);
app.use(corsGate);
app.use("/stripe/webhook", stripeWebhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (_req, res) => {
  const filePath = path.join(process.cwd(), "public", "index.html");
  res.sendFile(filePath);
});

app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

app.use("/legal", legalRouter);
app.use("/blog", blogRouter);
app.use("/config", configRouter);
app.use("/signals", signalsRouter);
app.use("/stripe", stripeRouter);
app.use("/admin", requireBearer, adminRouter);
app.use("/metrics", metricsRouter);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host);

export default app;

const TRUSTED_ORIGINS = new Set([
  "https://manysignals.finance",
  "https://www.manysignals.finance",
]);
const ALLOWED_METHODS = "GET,POST";
const ALLOWED_HEADERS = "Content-Type, Authorization";

function corsGate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const origin = req.headers.origin;
  if (origin && TRUSTED_ORIGINS.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.header("Access-Control-Expose-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    if (origin && TRUSTED_ORIGINS.has(origin)) {
      res.status(204).end();
      return;
    }
    res.status(403).end();
    return;
  }

  next();
}
