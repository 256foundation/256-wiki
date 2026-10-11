import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

export async function generateStaticParams() {
  // static export builds /topics/index.html as a directory listing of topics
  return [];
}

export default async function TopicsIndex() {
  const pack = await loadPack();
  return (
    <div className="wrap simple">
      <h1>Topics</h1>
      <p className="summary">
        {pack.pages.length} articles across {pack.topics.length} topics, each compiled from
        verbatim source captures.
      </p>
      <ul className="topicgrid" style={{ marginTop: 24 }}>
        {pack.topics.map((t) => (
          <li key={t.id}>
            <a className="topiccard" href={`/topics/${t.id}`}>
              <div className="topiccard-name">{t.name}</div>
              <div className="topiccard-desc">{t.description}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
