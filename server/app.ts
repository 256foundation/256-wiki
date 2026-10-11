import { Hono } from "hono";
import { cors } from "hono/cors";
import { getLiveStats } from "@/server/live";
import { buildIndex, retrieve } from "@/lib/retrieval";
import { pack } from "@/server/pack";

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

// retrieval index — built once per cold start (127 pages ≈ ms)
const searchIndex = buildIndex(pack);

app.get("/api/search", (c) => {
  const q = c.req.query("q") ?? "";
  const topic = c.req.query("topic") || undefined;
  const limit = Math.min(25, Math.max(1, Number(c.req.query("limit")) || 8));
  if (!q.trim()) return c.json({ query: q, packHash: pack.meta.contentHash, results: [] });
  const results = retrieve(searchIndex, q, { limit, topic });
  return c.json(
    { query: q, packHash: pack.meta.contentHash, count: results.length, results },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
});

app.get("/api/live.json", async (c) => {
  const stats = await getLiveStats();
  return c.json(stats, {
    headers: { "Cache-Control": "public, max-age=60" }, // CDN caches 60s too
  });
});

// Phase 2 wires the ask pipeline into these; /api/search above is already live.
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
