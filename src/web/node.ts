import { serve } from "@hono/node-server";
import { app } from "./server.js";
import { startSchedulers } from "../jobs/scheduler.js";
import { flushPublishQueue } from "../jobs/publishWorker.js";

const port = Number(process.env.PORT || 3000);
console.log(`[AuroraSignalX] listening on :${port}`);
serve({ fetch: app.fetch, port });

startSchedulers();
setTimeout(() => {
  flushPublishQueue().catch((err) => console.error('[startup] flush failed', err));
}, 5_000);
