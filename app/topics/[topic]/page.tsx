import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPack } from "@/lib/pack-loader";
import { pagesByTopic, isDisputed } from "@/lib/pack";

export const dynamicParams = false;

export async function generateStaticParams() {
  const pack = await loadPack();
  return pack.topics.map((t) => ({ topic: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  const t = (await loadPack()).topics.find((x) => x.id === topic);
  return t ? { title: t.name, description: t.description } : {};
}

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const pack = await loadPack();
  const t = pack.topics.find((x) => x.id === topic);
  if (!t) notFound();
  const pages = pagesByTopic(pack).get(topic) ?? [];

  return (
    <div className="wrap">
      <header className="pagehead">
        <p className="crumbs">
          <Link href="/">brain</Link> / topics
        </p>
        <h1 className="title">{t.name}</h1>
        {t.description && <p className="summary">{t.description}</p>}
        <p className="note">
          {pages.length} articles · As-Of = the date the volatile facts were last verified against
          sources
        </p>
      </header>

      <ul className="topiclist">
        {pages.map((p) => (
          <li key={p.slug}>
            <a className="topicrow-title" href={`/pages/${p.slug}`}>
              {p.title}
            </a>
            {p.summary && <p className="topicrow-summary">{p.summary}</p>}
            <div className="topicrow-meta">
              {p.asOf && <span>As-Of {p.asOf}</span>}
              {p.updated && <span>Updated {p.updated}</span>}
              {isDisputed(p) && <span className="badge disputed">Disputed</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
