export const metadata = { title: "Gaps — what the brain doesn't know" };

export default function GapsPage() {
  return (
    <div className="wrap simple">
      <h1>Open gaps</h1>
      <p className="summary">
        Questions people asked that the brain couldn't answer (or answered shakily). Curation is
        visible here: gaps become next week's ingest targets.
      </p>

      <div className="ask-shell">
        <p>
          <strong>The board lights up with the Phase 2/4 deploys.</strong> Every question the chat
          can't answer lands in the query log; a weekly job clusters them and files a{" "}
          <a href="https://github.com/256foundation/public-mining-brain/issues?q=label%3Acontent-gap">
            content-gap report issue
          </a>{" "}
          on the content repo.
        </p>
        <p className="note">
          Planned shape: “<em>N people asked this — the brain doesn't know yet</em>”, with a
          suggest-a-source CTA per gap.
        </p>
      </div>

      <h2>Know a source that would close a gap?</h2>
      <p>
        Don't wait for the board — <a href="/contribute">suggest the source now</a>. Ingestion is
        PR-based and open to everyone.
      </p>
    </div>
  );
}
