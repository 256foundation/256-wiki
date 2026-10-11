import { loadPack } from "@/lib/pack-loader";
import { pagesByTopic } from "@/lib/pack";
import LiveStrip from "@/components/LiveStrip";

export const metadata = {
  title: "Public Mining Brain — grounded bitcoin-mining knowledge",
};

export default async function HomePage() {
  const pack = await loadPack();
  const byTopic = pagesByTopic(pack);
  const disputed = pack.pages.filter((p) => p.statuses.includes("disputed")).length;

  return (
    <div className="wrap">
      <section className="hero">
        <h1>
          The bitcoin-mining brain.
          <br />
          Sources cited. Doubts kept.
        </h1>
        <p className="lede">
          A knowledge base maintained by AI agents under human review, compiled from verbatim
          source captures. Every volatile fact carries an <strong>As-Of</strong> date; every
          disagreement between sources stays visible as a <strong>Disputed</strong> block.
        </p>
        <form className="askbox" action="/ask" method="get">
          <input
            type="text"
            name="q"
            placeholder="Ask the brain — e.g. which ASIC is most efficient today?"
            aria-label="Ask the brain"
          />
          <button type="submit">Ask</button>
        </form>
        <p className="note">
          Or skip the quota entirely: <a href="/ask#connect-your-agent">connect your own agent</a>{" "}
          and use your own tokens — search and retrieval are free and unlimited.
        </p>
      </section>

      <LiveStrip />

      <section className="homesection">
        <h2>Browse by topic</h2>
        <p className="sub">
          {pack.pages.length} articles across {pack.topics.length} topics · {disputed} carrying
          live Disputed blocks
        </p>
        <ul className="topicgrid">
          {pack.topics.map((t) => {
            const count = byTopic.get(t.id)?.length ?? 0;
            return (
              <li key={t.id}>
                <a className="topiccard" href={`/topics/${t.id}`}>
                  <div className="topiccard-name">{t.name}</div>
                  <div className="topiccard-desc">{t.description}</div>
                  <div className="topiccard-count">
                    {count} {count === 1 ? "article" : "articles"}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="homesection">
        <h2>Connect your agent</h2>
        <p className="sub">
          The wiki is built for agents: a static knowledge pack, a REST API, and an MCP server.
          Retrieval costs you nothing and us almost nothing.
        </p>
        <div className="callout">
          Point your agent at <code>https://wiki.256foundation.org/mcp</code> — one line for Claude
          Code, Cursor, Codex or OpenCode. Full instructions on <a href="/ask#connect-your-agent">the ask page</a>.
        </div>
      </section>

      <PackHash hash={pack.meta.contentHash} generated={pack.meta.generated} />
    </div>
  );
}

function PackHash({ hash, generated }: { hash: string; generated: string }) {
  return (
    <p className="pagefoot-meta">
      knowledge pack {hash.slice(0, 19)}… · generated {generated.slice(0, 10)}
    </p>
  );
}
