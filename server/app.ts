import { Hono } from "hono";
import { cors } from "hono/cors";
import { getLiveStats } from "./live";

/**
 * The runtime API — deployed as one Node Lambda behind CloudFront (infra/).
 * Read endpoints the CDN doesn't serve statically live here (/api/search,
 * /api/live.json); ask/suggest/mcp join in Phases 2–3 sharing this app.
 * Same tree runs under `npm run dev:api` locally via @hono/node-server.
 */

export const app = new Hono();

app.use("/api/*", cors());
app.use("/mcp/*", cors());

app.get("/api/health", (c) => c.json({ ok: true, service: "256-wiki-api" }));

app.get("/api/live.json", async (c) => {
  const stats = await getLiveStats();
  return c.json(stats, {
    headers: { "Cache-Control": "public, max-age=60" }, // CDN caches 60s too
  });
});

// Phase 2 wires real retrieval (BM25/FTS over the bundled pack) into these.
app.get("/api/search", (c) => {
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.json({ query: q, results: [] });
  return c.json(
    { error: "not implemented until phase 2 (ask pipeline) — use /api/index.json or Pagefind" },
    501,
  );
});

app.post("/api/ask", (c) =>
  c.json({ error: "ask pipeline lands with phase 2 — the agent surface (MCP/REST) is the unlimited path" }, 501),
);

app.post("/api/suggest", (c) =>
  c.json({ error: "suggest→issue lands with phase 2 — for now use the GitHub issue template" }, 501),
);

// MCP streamable HTTP endpoint — placeholder until Phase 3.
app.all("/mcp", (c) =>
  c.json({ jsonrpc: "2.0", error: { code: -32000, message: "MCP server lands with phase 3" }, id: null }, 501),
);

export type App = typeof app;
