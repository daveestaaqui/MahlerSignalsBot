import "../config/providers";
import "./server";
import { startSchedulers } from "../jobs/scheduler";
import { flushPublishQueue } from "../jobs/publishWorker";
startSchedulers();
setTimeout(() => {
  flushPublishQueue().catch((err) => console.error('[startup] flush failed', err));
}, 5_000);
