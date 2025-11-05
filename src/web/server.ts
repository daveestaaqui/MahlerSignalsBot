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

if (process.env.NODE_ENV !== "production") {
  app.get("/routes", (_req, res) => {
    // @ts-ignore Accessing private Express internals for debugging surface list
    const stack = (app as any)._router?.stack || [];
    const paths: string[] = [];
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const method = (layer.route.stack[0]?.method || "get").toUpperCase();
        paths.push(`${method} ${layer.route.path}`);
      }
      if (layer.name === "router" && layer.handle?.stack) {
        for (const subLayer of layer.handle.stack) {
          if (subLayer.route && subLayer.route.path) {
            const method = (subLayer.route.stack[0]?.method || "get").toUpperCase();
            paths.push(`${method} /admin${subLayer.route.path}`);
          }
        }
      }
    }
    res.json({ paths });
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port);

export default app;
