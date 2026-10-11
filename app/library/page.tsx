import { loadPack } from "@/lib/pack-loader";
import { pagesByTopic } from "@/lib/pack";

export const metadata = {
  title: "Library",
  description: "Every article in the Public Mining Brain — search and browse by topic.",
};

export default async function LibraryPage() {
  const pack = await loadPack();
  const byTopic = pagesByTopic(pack);
  return (
    <div className="wrap simple">
      <h1>Library</h1>
      <p className="summary">
        {pack.pages.length} articles across {pack.topics.length} topics — every volatile fact
        carries an As-Of date.
      </p>
      <ul className="topicgrid" style={{ marginTop: 24 }}>
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
    </div>
  );
}
