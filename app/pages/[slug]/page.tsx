import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPack } from "@/lib/pack-loader";
import { isDisputed, isOutdated, rawLinkUrl, pageEditUrl, type PackPage } from "@/lib/pack";
import { splitStatusBlocks, wikiMarkdown } from "@/lib/epistemics";

export const dynamicParams = false;

export async function generateStaticParams() {
  const pack = await loadPack();
  return pack.pages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = (await loadPack()).pages.find((p) => p.slug === slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.summary,
    openGraph: {
      title: page.title,
      description: page.summary,
      type: "article",
      url: `/pages/${page.slug}/`,
      publishedTime: page.updated ?? undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await loadPack();
  const page = pack.pages.find((p) => p.slug === slug);
  if (!page) notFound();

  const bySlug = new Map(pack.pages.map((p) => [p.slug, p]));
  const segments = splitStatusBlocks(page.body);

  return (
    <div className="wrap">
      <header className="pagehead">
        <p className="crumbs">
          <Link href="/">brain</Link> / <a href={`/topics/${page.topic}`}>{page.topic}</a>
        </p>
        <h1 className="title">{page.title}</h1>
        {page.summary && <p className="summary">{page.summary}</p>}
        <Badges page={page} />
      </header>

      <article className="article">
        {segments.map((seg, i) =>
          seg.kind === "markdown" ? (
            <Markdown key={i} markdown={seg.text} topic={page.topic} />
          ) : (
            <StatusBlock key={i} status={seg.status} qualifier={seg.qualifier} body={seg.body} topic={page.topic} />
          ),
        )}
      </article>

      <Provenance page={page} bySlug={bySlug} />

      <footer className="pagefoot-meta">
        article wiki/{page.topic}/{page.slug}.md · pack {pack.meta.contentHash.slice(0, 19)}… ·{" "}
        <a href={pageEditUrl(page)}>edit on GitHub</a>
      </footer>
    </div>
  );
}

function Badges({ page }: { page: PackPage }) {
  return (
    <div className="badges">
      {page.asOf && <span className="badge asof">As-Of {page.asOf}</span>}
      {page.updated && <span className="badge">Updated {page.updated}</span>}
      {isDisputed(page) && <span className="badge disputed">Disputed</span>}
      {isOutdated(page) && <span className="badge outdated">Outdated</span>}
      <span className="badge">{page.topic}</span>
    </div>
  );
}

/** The epistemic callout — first-class amber, the visual signature of the wiki. */
function StatusBlock({ status, qualifier, body, topic }: { status: string; qualifier: string; body: string; topic: string }) {
  const kind = status.toLowerCase().startsWith("outdated") ? "outdated" : "disputed";
  const html = wikiMarkdown(body, topic);
  return (
    <aside className={`statusblock ${kind}`}>
      <div className="statushead">
        Status: {status}
        {qualifier ? ` — ${qualifier}` : ""}
      </div>
      <div className="statusbody" dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
}

function Markdown({ markdown, topic }: { markdown: string; topic: string }) {
  const html = wikiMarkdown(markdown, topic);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function Provenance({ page, bySlug }: { page: PackPage; bySlug: Map<string, PackPage> }) {
  return (
    <div className="provenance">
      <h3>Sources</h3>
      <ul>
        {page.sources.length ? (
          page.sources.map((s, i) => <li key={i}>{s}</li>)
        ) : (
          <li>see raw captures</li>
        )}
      </ul>
      <h3>Raw captures</h3>
      <ul>
        {page.rawLinks.length ? (
          page.rawLinks.map((r) => (
            <li key={r}>
              <a href={rawLinkUrl(r)}>{r}</a>
            </li>
          ))
        ) : (
          <li>none linked</li>
        )}
      </ul>
      {page.backlinks.length > 0 && (
        <>
          <h3>Backlinks ({page.backlinks.length})</h3>
          <div className="backlinks">
            {page.backlinks.map((slug) => {
              const p = bySlug.get(slug);
              return p ? (
                <a key={slug} className="backlink-chip" href={`/pages/${slug}`}>
                  {p.title}
                </a>
              ) : null;
            })}
          </div>
        </>
      )}
    </div>
  );
}
