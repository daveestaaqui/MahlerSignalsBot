import express from "express";
import bodyParser from "body-parser";

import adminRouter from "./routes/admin";
import stripeHandler from "./routes/stripe";

const app = express();

app.use(bodyParser.json({ type: "*/*" }));

app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

app.use("/admin", adminRouter);
app.post("/webhooks/stripe", stripeHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port);

export default app;
