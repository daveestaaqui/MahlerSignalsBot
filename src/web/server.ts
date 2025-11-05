import express from "express";
import adminRouter from "./routes/admin.js";
import stripeHandler from "./routes/stripe.js";
import { requireBearer } from "./middleware/auth.js";

const app = express();

// Stripe needs raw body for signature verification — mount FIRST
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeHandler
);

// All other routes parse JSON normally
app.use(express.json());

app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/healthz", (_req, res) => res.status(200).end("ok"));

// Protect admin routes with Bearer
app.use("/admin", requireBearer, adminRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port);

export default app;
