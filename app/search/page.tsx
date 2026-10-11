import PagefindSearch from "@/components/PagefindSearch";

export const metadata = {
  title: "Search",
  description: "Full-text search across the Public Mining Brain — built from the knowledge pack at deploy time.",
};

export default function SearchPage() {
  return (
    <div className="wrap simple">
      <h1>Search</h1>
      <p className="summary">
        Over every article in the brain — titles, summaries, and full bodies. Results show each
        article's As-Of date so you can judge freshness before you trust a number.
      </p>
      <div style={{ marginTop: 28 }}>
        <PagefindSearch />
      </div>
      <p className="note" style={{ marginTop: 24 }}>
        Prefer an API? <code>GET /api/search?q=</code> and <code>GET /api/index.json</code> serve
        the same corpus — see <a href="/SKILL.md">SKILL.md</a>.
      </p>
    </div>
  );
}
