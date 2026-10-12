export const metadata = { title: "Contribute" };

export default function ContributePage() {
  return (
    <div className="wrap simple">
      <h1>Contribute</h1>
      <p className="summary">
        Open source, open data, open PRs — maintained by agents under human review. You can work
        the same way on{" "}
        <a href="https://github.com/256foundation/public-mining-brain">public-mining-brain</a>.
      </p>

      <h2>Suggest a source</h2>
      <p>
        <a
          href="https://github.com/256foundation/public-mining-brain/issues/new?template=suggest-a-source.md"
        >
          File the issue
        </a>{" "}
        — maintainers register it with a refresh cadence; ingest agents pick it up.
      </p>

      <h2>Fix a page</h2>
      <p>
        PR against the article. Grounding rule: a changed number needs its raw source in{" "}
        <code>raw/</code>, linked from the article header; volatile facts update the As-Of stamp.
      </p>
      <pre><code>{`git clone https://github.com/256foundation/public-mining-brain
# edit wiki/<topic>/<article>.md
python3 scripts/lint_wiki.py   # must pass; --strict for PRs
git checkout -b fix/your-fix && git commit -m "wiki: …" && gh pr create`}</code></pre>

      <div className="callout">
        <strong>Ground rules:</strong> <code>raw/</code> is immutable · every load-bearing fact
        cites its source · volatile facts carry As-Of stamps · conflicts are recorded, not erased.
      </div>

      <p className="note">
        Full procedures live in the repo's <code>SKILL.md</code> and{" "}
        <code>CONTRIBUTING.md</code>. Tooling PRs welcome on{" "}
        <a href="https://github.com/256foundation/256-wiki">256-wiki</a> too.
      </p>
    </div>
  );
}
