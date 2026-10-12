export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="wrap simple">
      <h1>About</h1>
      <p className="summary">
        The 256 Foundation's public mining brain: bitcoin-mining knowledge compiled from verbatim
        source captures by AI agents under human review. Every volatile fact carries an{" "}
        <strong>As-Of</strong> date; every disagreement between sources stays visible as a{" "}
        <strong>Disputed</strong> block.
      </p>

      <h2>Why trust it</h2>
      <ul>
        <li>
          <strong>Provenance</strong> — every article links its raw captures; every render records
          the knowledge-pack hash it was built from.
        </li>
        <li>
          <strong>Honesty</strong> — gaps are public (<a href="/gaps">the board</a>), conflicts are
          recorded, never averaged away.
        </li>
        <li>
          <strong>Open</strong> — content and code are open source; PRs are the write path.
        </li>
      </ul>

      <h2>Links</h2>
      <p>
        <a href="https://256foundation.org">256foundation.org</a> ·{" "}
        <a href="https://github.com/256foundation/public-mining-brain">content repo</a> ·{" "}
        <a href="https://github.com/256foundation/256-wiki">site code</a> ·{" "}
        <a href="/agents">for agents</a> · <a href="/privacy">privacy</a>
      </p>
      <p className="note">256 Foundation is a 501(c)(3) public charity.</p>
    </div>
  );
}
