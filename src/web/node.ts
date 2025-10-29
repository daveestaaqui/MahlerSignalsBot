import { serve } from "@hono/node-server";
import { app } from "./server.js";

const port = Number(process.env.PORT || 3000);
console.log(`[AuroraSignalX] listening on :${port}`);
serve({ fetch: app.fetch, port });
