import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

const SITE = "https://wiki.256foundation.org";

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** GET /api/feed.xml — RSS 2.0 of recently updated articles (Phase 1 read surface). */
export async function GET() {
  const pack = await loadPack();
  const pages = [...pack.pages]
    .filter((p) => p.updated)
    .sort((a, b) => (a.updated! < b.updated! ? 1 : -1))
    .slice(0, 50);

  const items = pages
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE}/pages/${p.slug}/</link>
      <guid isPermaLink="true">${SITE}/pages/${p.slug}/</guid>
      <description>${escapeXml(p.summary)}</description>
      <category>${escapeXml(p.topic)}</category>
      <pubDate>${new Date((p.updated ?? "1970-01-01") + "T00:00:00Z").toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>256 Foundation — Public Mining Brain</title>
    <link>${SITE}/</link>
    <description>Grounded, As-Of-stamped bitcoin-mining knowledge, maintained by agents under human review.</description>
    <language>en</language>
    <lastBuildDate>${new Date(pack.meta.generated).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/api/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
