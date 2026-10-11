import { loadPack } from "@/lib/pack-loader";
import { isDisputed } from "@/lib/pack";

export const dynamic = "force-static";

/** GET /api/index.json — the full topic/article index (CDN-cached, CORS open).
 * The agent-favorite first call: summaries, Updated, As-Of for everything. */
export async function GET() {
  const pack = await loadPack();
  const body = {
    meta: pack.meta,
    topics: pack.topics,
    articles: pack.pages.map((p) => ({
      slug: p.slug,
      topic: p.topic,
      title: p.title,
      summary: p.summary,
      updated: p.updated,
      asOf: p.asOf,
      disputed: isDisputed(p),
      url: `https://wiki.256foundation.org/pages/${p.slug}`,
      markdown: `https://wiki.256foundation.org/api/pages/${p.slug}.md`,
    })),
  };
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
