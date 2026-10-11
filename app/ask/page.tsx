import type { Metadata } from "next";
import AskConsole from "@/components/AskConsole";

export const metadata: Metadata = {
  title: "Ask the brain",
  description:
    "Grounded answers from the 256 Foundation Public Mining Brain — every answer cites its wiki sources with As-Of dates and gets a permanent permalink.",
};

const ANON_QUOTA = Number(process.env.NEXT_PUBLIC_ANON_QUOTA || 5);

export default function AskPage() {
  return (
    <div className="wrap simple">
      <h1>Ask the brain</h1>
      <p className="summary">
        Grounded answers from the Public Mining Brain — every answer cites its wiki sources with
        As-Of dates, surfaces disputes instead of picking winners, and links a permanent permalink
        you can share or cite.
      </p>

      <AskConsole anonQuota={ANON_QUOTA} />

      <p className="note">
        Anonymous: {ANON_QUOTA} answers/day · signed-in: 25/day · repeated questions are served from
        cache and never cost anyone anything · when the foundation's daily token budget is spent, the
        agent path below stays wide open.
      </p>

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
        <code>/api/pages/&lt;slug&gt;.md</code> · <code>/api/live.json</code> · <code>POST /api/ask</code> · docs land
        with the Phase 3 deploy.
      </p>
    </div>
  );
}
