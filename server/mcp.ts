/** MCP streamable-HTTP server — the unlimited agent path (plan §1, Phase 3).
 *
 * POST /mcp speaks JSON-RPC 2.0 per the streamable-HTTP transport: initialize,
 * tools/list, tools/call, resources/list, resources/read. Responses are plain
 * JSON (no SSE needed for a stateless retrieval server); notifications get 202.
 *
 * Everything here is FREE and unmetered by design — agents bring their own
 * model; the foundation pays zero tokens for this surface. Tools mirror the
 * REST API so either transport gives the same grounding material.
 */

import { Hono } from "hono";
import { buildIndex, retrieve } from "../lib/retrieval";
import { pack } from "./pack";

const SITE = process.env.PUBLIC_BASE_URL || "https://wiki.256foundation.org";
const PROTOCOL_VERSION = "2025-06-18";

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function pageUrl(slug: string): string {
  return `${SITE}/pages/${slug}/`;
}

function pageMarkdown(slug: string): string | null {
  const page = pack.pages.find((p) => p.slug === slug);
  if (!page) return null;
  const head = [
    `# ${page.title}`,
    "",
    `- Topic: ${page.topic}`,
    page.asOf ? `- As-Of: ${page.asOf}` : null,
    page.statuses.length ? `- Statuses: ${page.statuses.join(", ")}` : null,
    `- URL: ${pageUrl(slug)}`,
    "",
    page.summary ? `> ${page.summary}` : null,
    "",
  ]
    .filter((x) => x !== null)
    .join("\n");
  return `${head}\n${page.body}\n`;
}

function jsonText(value: unknown): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
}

// tools share one cold-start index (built alongside the app's /api/search index)
const toolIndex = buildIndex(pack);

function callTool(name: string, args: Record<string, unknown>): { content: ReturnType<typeof jsonText>; isError?: boolean } {
  switch (name) {
    case "search_wiki": {
      const query = String(args.query ?? "").trim();
      if (!query) return { content: jsonText({ error: "query required" }), isError: true };
      const topic = typeof args.topic === "string" && args.topic ? args.topic : undefined;
      const limit = Math.min(25, Math.max(1, Number(args.limit) || 8));
      const results = retrieve(toolIndex, query, { limit, topic }).map((h) => ({
        slug: h.slug,
        title: h.title,
        topic: h.topic,
        url: pageUrl(h.slug),
        asOf: h.asOf,
        statuses: h.statuses,
        score: h.score,
        snippet: h.snippet,
      }));
      return {
        content: jsonText({
          query,
          packHash: pack.meta.contentHash,
          note: "Ground answers in these results; cite article URLs with their As-Of dates; keep Disputed blocks visible.",
          results,
        }),
      };
    }
    case "get_page": {
      const slug = String(args.slug ?? "");
      const md = pageMarkdown(slug);
      if (!md) return { content: jsonText({ error: `no page ${slug}` }), isError: true };
      return { content: jsonText(md) };
    }
    case "list_topics": {
      const topics = new Map<string, number>();
      for (const p of pack.pages) topics.set(p.topic, (topics.get(p.topic) ?? 0) + 1);
      return {
        content: jsonText({
          packHash: pack.meta.contentHash,
          pageCount: pack.pages.length,
          topics: [...topics.entries()].map(([name, count]) => ({ name, count })),
        }),
      };
    }
    case "get_pack": {
      return {
        content: jsonText({
          meta: pack.meta,
          note: "Full index below; fetch any page via get_page or /api/pages/<slug>.md",
          pages: pack.pages.map((p) => ({
            slug: p.slug,
            title: p.title,
            topic: p.topic,
            asOf: p.asOf,
            statuses: p.statuses,
            url: pageUrl(p.slug),
          })),
        }),
      };
    }
    default:
      return { content: jsonText({ error: `unknown tool ${name}` }), isError: true };
  }
}

// ── tool schemas ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_wiki",
    description:
      "Full-text BM25 search over the 256 Foundation Public Mining Brain (bitcoin-mining knowledge base). Returns ranked articles with slug, title, As-Of date, status flags (Disputed/Outdated) and a snippet. Ground every answer in these results and cite the article URLs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "search query — numbers and model names are tokens (e.g. 's21 473', 'fpps fees')" },
        topic: { type: "string", description: "optional topic filter (see list_topics)" },
        limit: { type: "number", description: "max results, default 8, max 25" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description:
      "Fetch one wiki article as markdown, with its As-Of date and epistemic status flags. Use after search_wiki to read the full article (specs, Disputed blocks, sources).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "article slug, e.g. 'antminer-s21-xp-hyd'" } },
      required: ["slug"],
    },
  },
  {
    name: "list_topics",
    description: "List the knowledge pack's topics with article counts — good first call for orientation.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_pack",
    description: "Knowledge-pack metadata + the full article index (slug/title/topic/As-Of per page). Use for bulk orientation; fetch bodies with get_page.",
    inputSchema: { type: "object", properties: {} },
  },
];

function handleRpc(req: RpcRequest): { status: number; body: unknown; sessionId?: string } {
  // notifications (no id) → accept, no response body
  if (req.id === undefined || req.id === null) {
    return { status: 202, body: null };
  }
  switch (req.method) {
    case "initialize":
      return {
        status: 200,
        sessionId: crypto.randomUUID(),
        body: {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false }, resources: { subscribe: false } },
            serverInfo: {
              name: "256-foundation-mining-brain",
              version: `pack:${pack.meta.contentHash.slice(7, 15)}`,
            },
            instructions:
              "Bitcoin-mining knowledge base. search_wiki first, then get_page for the full article. Ground answers in returned content; cite article URLs with As-Of dates; surface Disputed blocks instead of picking a winner; say when the brain doesn't know. Retrieval is free and unmetered.",
          },
        },
      };
    case "tools/list":
      return { status: 200, body: { jsonrpc: "2.0", id: req.id, result: { tools: TOOLS } } };
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments as Record<string, unknown>) ?? {};
      const out = callTool(name, args);
      return { status: 200, body: { jsonrpc: "2.0", id: req.id, result: out } };
    }
    case "resources/list":
      return {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            resources: pack.pages.map((p) => ({
              uri: `wiki://pages/${p.slug}.md`,
              name: p.title,
              description: `${p.topic}${p.asOf ? ` · As-Of ${p.asOf}` : ""}${p.statuses.length ? ` · ${p.statuses.join("/")}` : ""}`,
              mimeType: "text/markdown",
            })),
          },
        },
      };
    case "resources/read": {
      const uri = String(req.params?.uri ?? "");
      const match = /^wiki:\/\/pages\/([a-z0-9-]+)\.md$/.exec(uri);
      const md = match ? pageMarkdown(match[1]) : null;
      if (!md) {
        return {
          status: 200,
          body: { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: `unknown resource ${uri}` } },
        };
      }
      return {
        status: 200,
        body: { jsonrpc: "2.0", id: req.id, result: { contents: [{ uri, mimeType: "text/markdown", text: md }] } },
      };
    }
    case "ping":
      return { status: 200, body: { jsonrpc: "2.0", id: req.id, result: {} } };
    default:
      return {
        status: 200,
        body: { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `method not found: ${req.method}` } },
      };
  }
}

export function mcpRoutes(): Hono {
  const mcp = new Hono();

  mcp.post("/mcp", async (c) => {
    let rpc: RpcRequest | RpcRequest[];
    try {
      rpc = await c.req.json();
    } catch {
      return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
    }
    if (Array.isArray(rpc)) {
      const results = rpc.map(handleRpc);
      const bodies = results.filter((r) => r.status !== 202).map((r) => r.body);
      const sid = results.find((r) => r.sessionId)?.sessionId;
      const headers: Record<string, string> = {};
      if (sid) headers["Mcp-Session-Id"] = sid;
      return c.json(bodies, 200, headers);
    }
    const out = handleRpc(rpc);
    if (out.status === 202) return c.body(null, 202);
    const headers: Record<string, string> = {};
    if (out.sessionId) headers["Mcp-Session-Id"] = out.sessionId;
    return c.json(out.body, 200, headers);
  });

  // stateless server: no server→client stream to hold open
  mcp.get("/mcp", (c) =>
    c.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "GET/SSE not supported — POST JSON-RPC" } }, 405),
  );
  mcp.delete("/mcp", (c) => c.body(null, 204));

  return mcp;
}
