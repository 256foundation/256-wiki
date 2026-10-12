export const metadata = {
  title: "Agents",
  description:
    "Point any agent at the Public Mining Brain: MCP server, REST endpoints, SKILL.md. Retrieval is free and unmetered — bring your own model.",
};

const SNIPPET = `You are answering bitcoin-mining questions using the 256 Foundation Public
Mining Brain. First read https://wiki.256foundation.org/SKILL.md and follow it.
Search the wiki before answering; cite article permalinks with their As-Of
dates; show Disputed blocks when sources disagree; say when the brain does
not know.`;

const ENDPOINTS: Array<[string, string]> = [
  ["GET /api/search?q=", "BM25 search — ranked hits with snippets and As-Of"],
  ["GET /api/pages/<slug>.md", "full article markdown"],
  ["GET /api/list/topics.json", "topic index"],
  ["GET /api/pack.json", "the whole knowledge pack, one fetch, content-hashed"],
  ["GET /api/index.json", "search index dump"],
  ["POST /api/ask", "grounded answer w/ citations (rate-limited, cached)"],
  ["GET /api/gaps.json", "what the brain doesn't know — public gap board"],
  ["GET /mcp", "MCP streamable HTTP — tools + wiki:// resources"],
];

export default function AgentsPage() {
  return (
    <div className="wrap simple">
      <h1>Agents</h1>
      <p className="summary">
        The brain is built for agents: retrieval (search, pages, pack, MCP) is free and unmetered —
        bring your own model. The web chat is the only rate-limited path.
      </p>

      <h2>MCP — one line</h2>
      <pre><code>{`claude mcp add mining-brain https://wiki.256foundation.org/mcp`}</code></pre>
      <pre><code>{`codex mcp add mining-brain --url https://wiki.256foundation.org/mcp`}</code></pre>
      <pre><code>{`opencode mcp add --transport http mining-brain https://wiki.256foundation.org/mcp`}</code></pre>
      <pre><code>{`# .cursor/mcp.json
{ "mcpServers": { "mining-brain": { "url": "https://wiki.256foundation.org/mcp" } } }`}</code></pre>

      <h2>No agent? Paste this into any chat</h2>
      <pre><code>{SNIPPET}</code></pre>

      <h2>REST</h2>
      <table className="endpointtable">
        <tbody>
          {ENDPOINTS.map(([ep, what]) => (
            <tr key={ep}>
              <td><code>{ep}</code></td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note">
        Doc for LLMs: <a href="/SKILL.md">SKILL.md</a> (the query→fetch→cite loop) ·{" "}
        <a href="/llms.txt">llms.txt</a> (site index for crawlers).
      </p>
    </div>
  );
}
