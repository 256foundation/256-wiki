export const metadata = { title: "About — the curation story" };

export default function AboutPage() {
  return (
    <div className="wrap simple">
      <h1>About this wiki</h1>
      <p className="summary">
        The 256 Foundation's moat is <strong>curation</strong>: grounded, As-Of-stamped,
        Disputed-block-honest bitcoin-mining knowledge, maintained by agents under human review.
      </p>

      <h2>How it works</h2>
      <p>
        Sources (manufacturer spec sheets, manuals, pool documentation, filings, field reports) are
        captured <em>verbatim</em> into an immutable <code>raw/</code> archive in the{" "}
        <a href="https://github.com/256foundation/public-mining-brain">public-mining-brain</a>{" "}
        repository. AI agents compile those sources into wiki articles. Every load-bearing number,
        date, and quote must exist in the linked raw captures — lint enforces it mechanically, and
        humans review every merge.
      </p>

      <h2>The epistemics are the product</h2>
      <ul>
        <li>
          <strong>As-Of stamps</strong> — mining facts rot: fees, firmware, prices, hashrate. Any
          volatile claim carries the date it was last verified.
        </li>
        <li>
          <strong>Disputed blocks</strong> — when a manufacturer sheet and a third-party database
          disagree, the wiki shows both with attribution instead of averaging them away.
        </li>
        <li>
          <strong>Outdated blocks</strong> — superseded facts are marked and explained, never
          silently rewritten.
        </li>
        <li>
          <strong>Provenance</strong> — every article links its raw captures; every page render
          records the knowledge-pack content hash it was built from.
        </li>
      </ul>

      <h2>How agents update the wiki</h2>
      <p>
        Scheduled agent loops run freshness scans and deep sweeps per the{" "}
        <a href="https://github.com/256foundation/public-mining-brain/blob/main/automation/AGENT-PLAYBOOK.md">
          agent playbook
        </a>
        . All agent work lands as pull requests — humans review and merge.{" "}
        <a href="/contribute">You can contribute the same way.</a>
      </p>

      <h2>For agents</h2>
      <p>
        Everything read-side is open: <a href="/llms.txt">llms.txt</a>,{" "}
        <a href="/SKILL.md">SKILL.md</a>, the REST API, and an MCP server at{" "}
        <code>https://wiki.256foundation.org/mcp</code>. Clone the repo if you prefer — the pack is
        a build artifact of it — but the API is always fresher.
      </p>

      <h2>The foundation</h2>
      <p>
        The 256 Foundation is a 501(c)(3) public charity building open infrastructure for bitcoin
        mining — see <a href="https://256foundation.org">256foundation.org</a>. The web chat on
        this site is foundation-funded and rate-limited; agents connecting with their own tokens
        pay nothing to anyone.
      </p>
    </div>
  );
}
