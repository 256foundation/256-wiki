import { Hono } from "hono";
import { cors } from "hono/cors";
import { getLiveStats } from "@/server/live";
import { buildIndex, retrieve } from "@/lib/retrieval";
import { pack } from "@/server/pack";
import { selectStore } from "@/server/store";
import { handleAsk } from "@/server/ask";
import { renderAnswerPage, renderNotFound } from "@/server/permalink";
import { llmConfigured } from "@/server/llm";

/**
 * The runtime API — deployed as one Node Lambda behind CloudFront (infra/).
 * Read endpoints the CDN doesn't serve statically live here (/api/search,
 * /api/live.json); ask/suggest/mcp join in Phases 2–3 sharing this app.
 * Same tree runs under `npm run dev:api` locally via @hono/node-server.
 */

export const app = new Hono();

app.use("/api/*", cors());
app.use("/mcp/*", cors());

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "256-wiki-api",
    store: store.kind,
    llm: llmConfigured() ? "configured" : "not-configured (dev: ask returns 503, search works)",
    packHash: pack.meta.contentHash,
  }),
);

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

// persistence — DynamoDB in prod (tables configured), in-memory in dev/tests
const store = selectStore();

// ask pipeline (plan §3): turnstile → cache → breaker → retrieve → quota → LLM
app.post("/api/ask", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  let input: { question?: string; history?: Array<{ role: "user" | "assistant"; content: string }>; turnstileToken?: string };
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "invalid-json" }, 400);
  }
  const outcome = await handleAsk(
    store,
    searchIndex,
    input,
    { ip, tier: "anon" }, // signed-in tiers join in the identity slice
  );
  if (!outcome.ok) return c.json(outcome.body, outcome.status as 400 | 403 | 429 | 502 | 503);
  return c.json(outcome.body, 200);
});

// GET /api/ask — self-describing for the curious (and for /SKILL.md later)
app.get("/api/ask", (c) =>
  c.json({
    endpoint: "POST /api/ask",
    body: { question: "string (required, ≤2000 chars)", turnstileToken: "string (when turnstile enabled)" },
    limits: {
      anonPerDay: Number(process.env.ANON_DAILY_QUOTA || 5),
      signedInPerDay: Number(process.env.SIGNEDIN_DAILY_QUOTA || 25),
      cacheHits: "free",
      breaker: `global daily token budget ${process.env.LLM_DAILY_TOKEN_BUDGET || 3000000}`,
    },
    unlimitedPath: "MCP /mcp + /api/search — bring your own model",
    packHash: pack.meta.contentHash,
  }),
);

// answer permalinks — HTML rendered here (static export can't SSR)
app.get("/a/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[a-f0-9]{24}\.[a-f0-9]{10}$/.test(id)) return c.html(renderNotFound(id), 404);
  const row = await store.getAnswerById(id);
  if (!row) return c.html(renderNotFound(id), 404);
  return c.html(renderAnswerPage(row), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
});

app.post("/api/suggest", (c) =>
  c.json({ error: "suggest→issue lands with phase 2 — for now use the GitHub issue template" }, 501),
);

// MCP streamable HTTP endpoint — placeholder until Phase 3.
app.all("/mcp", (c) =>
  c.json({ jsonrpc: "2.0", error: { code: -32000, message: "MCP server lands with phase 3" }, id: null }, 501),
);

export type App = typeof app;
