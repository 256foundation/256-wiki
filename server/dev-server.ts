/** Local dev API server — esbuild-bundled then run under plain node
 * (keeps the toolchain identical to the Lambda build; no tsx dep). */
import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`256-wiki API on http://localhost:${info.port} (next dev proxies /api + /mcp here)`);
});
