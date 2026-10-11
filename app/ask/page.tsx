export const metadata = { title: "Ask the brain" };

export default function AskPage() {
  return (
    <div className="wrap simple">
      <h1>Ask the brain</h1>
      <p className="summary">
        Grounded answers from the Public Mining Brain — every answer cites its wiki sources with
        As-Of dates, and links a permanent permalink you can share.
      </p>

      <div className="ask-shell">
        <p>
          <strong>Chat opens with the Phase 2 deploy.</strong> The retrieval + answer pipeline is
          being wired now — this shell ships early so the surface and copy are reviewable.
        </p>
        <p className="note">
          Anonymous: 5 answers/day per IP (Turnstile-gated) · signed-in: 25/day ·
          cache hits never cost a thing.
        </p>
      </div>

      <h2 id="connect-your-agent">Connect your own agent — the unlimited path</h2>
      <p>
        The web chat is rate-limited because <em>the foundation pays for those tokens</em>. Your
        agent using <strong>your</strong> tokens has no such cap: retrieval (search, pages, pack)
        is free and unmetered.
      </p>

      <h3>Claude Code</h3>
      <pre><code>{`claude mcp add mining-brain https://wiki.256foundation.org/mcp`}</code></pre>

      <h3>Cursor</h3>
      <pre><code>{`# .cursor/mcp.json
{ "mcpServers": { "mining-brain": { "url": "https://wiki.256foundation.org/mcp" } } }`}</code></pre>

      <h3>Codex CLI</h3>
      <pre><code>{`codex mcp add mining-brain --url https://wiki.256foundation.org/mcp`}</code></pre>

      <h3>OpenCode</h3>
      <pre><code>{`opencode mcp add --transport http mining-brain https://wiki.256foundation.org/mcp`}</code></pre>

      <h3>No agent? Paste this into any chat</h3>
      <p>
        Fetch <code>https://wiki.256foundation.org/SKILL.md</code> first — it teaches any LLM the
        query→fetch→cite loop in a couple of kilobytes.
      </p>
      <pre><code>{`You are answering bitcoin-mining questions using the 256 Foundation Public
Mining Brain. First read https://wiki.256foundation.org/SKILL.md and follow it.
Search the wiki before answering; cite article permalinks with their As-Of
dates; show Disputed blocks when sources disagree; say when the brain does
not know.`}</code></pre>

      <p className="note">
        API reference: <code>/api/index.json</code> · <code>/api/search?q=</code> ·{" "}
        <code>/api/pages/&lt;slug&gt;.md</code> · <code>/api/live.json</code> · docs land with the
        Phase 3 deploy.
      </p>
    </div>
  );
}
