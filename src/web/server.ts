import path from "path";
import express from "express";
import adminRouter from "./routes/admin";
import metricsRouter from "./routes/metrics";
import blogRouter from "./routes/blog";
import legalRouter from "./routes/legal";
import signalsRouter from "./routes/signals";
import stripeRouter from "./routes/stripe";
import configRouter from "./routes/config";
import { requireBearer } from "../lib/auth";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/", (_req, res) => {
  const filePath = path.join(process.cwd(), "public", "index.html");
  res.sendFile(filePath);
});

app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

app.use("/", legalRouter);
app.use("/", blogRouter);
app.use("/", configRouter);
app.use("/", signalsRouter);
app.use("/", stripeRouter);
app.use("/admin", requireBearer, adminRouter);
app.use("/metrics", metricsRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port);

export default app;
