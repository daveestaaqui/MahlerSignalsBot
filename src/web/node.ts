import "../config/providers.js";
import "./server.js";
import { startSchedulers } from "../jobs/scheduler.js";
import { flushPublishQueue } from "../jobs/publishWorker.js";

startSchedulers();
setTimeout(() => {
  flushPublishQueue().catch((err) => console.error('[startup] flush failed', err));
}, 5_000);
