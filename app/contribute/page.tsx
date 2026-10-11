export const metadata = { title: "Contribute" };

export default function ContributePage() {
  return (
    <div className="wrap simple">
      <h1>Contribute</h1>
      <p className="summary">
        Open source, open data, open PRs. This brain is maintained by LLM agents under human
        review — you can contribute the same way: issues and PRs on{" "}
        <a href="https://github.com/256foundation/public-mining-brain">public-mining-brain</a>.
      </p>

      <h2>Suggest a source</h2>
      <p>
        The fastest way to grow the brain. The server form (below, live with Phase 2) files a
        pre-filled GitHub issue; or{" "}
        <a href="https://github.com/256foundation/public-mining-brain/issues/new?template=suggest-a-source.md">
          open one directly
        </a>
        . Maintainers register durable sources with a refresh cadence and ingest agents pick them up.
      </p>

      <h2>Fix or improve a wiki page</h2>
      <p>
        PRs directly against the article in the content repo. Keep the grounding rule: if you add
        or change a number, the raw source backing it must be in <code>raw/</code> and linked from
        the article's <code>Raw:</code> header. Volatile facts update the As-Of stamp.
      </p>
      <pre><code>{`git clone https://github.com/256foundation/public-mining-brain
# edit wiki/<topic>/<article>.md
python3 scripts/lint_wiki.py   # must pass; --strict for PRs
git checkout -b fix/your-fix && git commit -m "wiki: …" && gh pr create`}</code></pre>

      <h2>Ingest a source yourself</h2>
      <ol>
        <li>
          Save the source (verbatim where licensing allows) to <code>raw/inbox/YYYY-MM-DD-slug.md</code>{" "}
          with the metadata header from <code>references/raw-template.md</code>.
        </li>
        <li>Follow the Ingest procedure in <code>SKILL.md</code> — or let an agent do it.</li>
        <li>Update <code>wiki/index.md</code> and <code>wiki/log.md</code>.</li>
        <li>Run lint. Open a PR.</li>
      </ol>

      <div className="callout">
        <strong>Ground rules (from CONTRIBUTING.md):</strong> <code>raw/</code> is immutable · every
        load-bearing fact cites its source · volatile facts carry As-Of stamps · conflicts are
        recorded, not erased · lint must pass · no binaries over 5&nbsp;MB.
      </div>

      <h2>Improve the tooling</h2>
      <p>
        <code>scripts/</code>, <code>automation/</code>, and the site itself are normal open-source
        code — PRs welcome on{" "}
        <a href="https://github.com/256foundation/256-wiki">256-wiki</a> too.
      </p>
    </div>
  );
}
