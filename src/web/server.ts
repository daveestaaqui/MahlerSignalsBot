import express from "express";
import path from "path";
import adminRouter from "./routes/admin";
import metricsRouter from "./routes/metrics";
import blogRouter from "./routes/blog";
import legalRouter from "./routes/legal";
import configRouter from "./routes/config";
import { requireBearer } from "./middleware/auth";
import { requestLogger } from "../lib/logger";

const app = express();
app.use(express.json());
app.use(requestLogger);

const publicDir = path.resolve(__dirname, "../../public");
app.use(express.static(publicDir));

// core endpoints
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

// routers
app.use("/admin", requireBearer, adminRouter);
app.use("/metrics", metricsRouter);
app.use("/legal", legalRouter);
app.use("/blog", blogRouter);
app.use("/config", configRouter);

export default app;
