import express from "express";
import adminRouter from "./routes/admin";
import metricsRouter from "./routes/metrics";
import blogRouter from "./routes/blog";
import legalRouter from "./routes/legal";
import { requireBearer } from "../lib/auth";

const app = express();
app.use(express.json());

// core endpoints
app.get("/", (_req, res) => res.status(200).end("Aurora-Signals OK"));
app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

// routers
app.use("/admin", requireBearer, adminRouter);
app.use("/metrics", metricsRouter);
app.use("/legal", legalRouter);
app.use("/blog", blogRouter);

export default app;

// --- ensure blog route mounted ---
app.use('/blog', blogRouter);
