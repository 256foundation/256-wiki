/** MCP streamable-HTTP endpoint — protocol-level tests via the Hono app. */

import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../server/app";
import { pack } from "../server/pack";

function rpc(id: number | null, method: string, params?: Record<string, unknown>) {
  const body: Record<string, unknown> = { jsonrpc: "2.0", method };
  if (id !== null) body.id = id;
  if (params) body.params = params;
  return app.request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("MCP /mcp", () => {
  it("initializes and reports capabilities + instructions", async () => {
    const res = await rpc(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
    const body = (await res.json()) as { result: { protocolVersion: string; serverInfo: { name: string }; instructions: string } };
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.serverInfo.name).toContain("mining-brain");
    expect(body.result.instructions).toContain("As-Of");
  });

  it("lists the four retrieval tools with schemas", async () => {
    const res = await rpc(2, "tools/list");
    const body = (await res.json()) as { result: { tools: Array<{ name: string; inputSchema: object }> } };
    expect(body.result.tools.map((t) => t.name)).toEqual(["search_wiki", "get_page", "list_topics", "get_pack"]);
    for (const t of body.result.tools) expect(t.inputSchema).toBeTruthy();
  });

  it("search_wiki returns ranked, As-Of-stamped results", async () => {
    const res = await rpc(3, "tools/call", { name: "search_wiki", arguments: { query: "immersion cooling", limit: 3 } });
    const body = (await res.json()) as { result: { content: Array<{ type: string; text: string }>; isError?: boolean } };
    expect(body.result.isError).toBeFalsy();
    const payload = JSON.parse(body.result.content[0].text) as { results: Array<{ slug: string; asOf: string | null; url: string }> };
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0].url).toContain("/pages/");
  });

  it("get_page returns the full markdown with As-Of header", async () => {
    // pick a page from the loaded pack (pack-agnostic: CI runs a 6-page sample)
    const page = pack.pages.find((p) => p.body.length > 200 && p.asOf) ?? pack.pages[0];
    const res = await rpc(4, "tools/call", { name: "get_page", arguments: { slug: page.slug } });
    const body = (await res.json()) as { result: { content: Array<{ text: string }>; isError?: boolean } };
    expect(body.result.isError).toBeUndefined();
    expect(body.result.content[0].text).toContain(`# ${page.title}`);
    if (page.asOf) expect(body.result.content[0].text).toContain("As-Of:");
  });

  it("get_page on an unknown slug is a tool error", async () => {
    const res = await rpc(5, "tools/call", { name: "get_page", arguments: { slug: "nope-nope" } });
    const body = (await res.json()) as { result: { isError?: boolean } };
    expect(body.result.isError).toBe(true);
  });

  it("resources are listed and readable as markdown", async () => {
    const list = await rpc(6, "resources/list");
    const listBody = (await list.json()) as { result: { resources: Array<{ uri: string }> } };
    // one resource per pack page (pack-agnostic: CI runs a 6-page sample)
    expect(listBody.result.resources.length).toBe(pack.pages.length);
    const some = listBody.result.resources[0].uri;
    const read = await rpc(7, "resources/read", { uri: some });
    const readBody = (await read.json()) as { result: { contents: Array<{ uri: string; mimeType: string; text: string }> } };
    expect(readBody.result.contents[0].mimeType).toBe("text/markdown");
    expect(readBody.result.contents[0].text.length).toBeGreaterThan(100);
  });

  it("unknown resource → JSON-RPC invalid-params error", async () => {
    const res = await rpc(8, "resources/read", { uri: "wiki://pages/does-not-exist.md" });
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32602);
  });

  it("unknown method → -32601; notifications → 202 empty", async () => {
    const bad = await rpc(9, "wat/nope");
    const badBody = (await bad.json()) as { error: { code: number } };
    expect(badBody.error.code).toBe(-32601);

    const note = await rpc(null, "notifications/initialized");
    expect(note.status).toBe(202);
    expect(await note.text()).toBe("");
  });

  it("GET /mcp explains POST-only (405); DELETE is a no-op 204", async () => {
    const get = await app.request("/mcp");
    expect(get.status).toBe(405);
    const del = await app.request("/mcp", { method: "DELETE" });
    expect(del.status).toBe(204);
  });
});
