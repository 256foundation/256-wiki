import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

/** GET /api/pages/<slug>.md and /api/pages/<slug>.json — raw markdown (the
 * agent-favorite) and structured JSON with metadata + backlinks + statuses.
 * Static export: generateStaticParams emits one file per page per extension. */
export async function generateStaticParams() {
  const pack = await loadPack();
  return pack.pages.flatMap((p) => [{ slug: `${p.slug}.md` }, { slug: `${p.slug}.json` }]);
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const ext = raw.endsWith(".json") ? "json" : raw.endsWith(".md") ? "md" : null;
  const slug = raw.replace(/\.(md|json)$/, "");
  if (!ext) return new Response("use .md or .json", { status: 404 });

  const page = (await loadPack()).pages.find((p) => p.slug === slug);
  if (!page) return new Response("not found", { status: 404 });

  const headers = {
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  };

  if (ext === "md") {
    const md = renderMarkdown(page);
    return new Response(md, { headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" } });
  }

  return Response.json(
    { ...page, url: `https://wiki.256foundation.org/pages/${slug}` },
    { headers },
  );
}

/** Header block + body, exactly as stored in the wiki repo. */
function renderMarkdown(p: { topic: string; slug: string; title: string; body: string; asOf: string | null; updated: string | null }): string {
  const lines = [
    `# ${p.title}`,
    "",
    p.asOf ? `> As-Of: ${p.asOf}` : "",
    p.updated ? `> Updated: ${p.updated}` : "",
    `> Source: https://github.com/256foundation/public-mining-brain/blob/main/wiki/${p.topic}/${p.slug}.md`,
    "",
    p.body,
  ];
  return lines.filter((l) => l !== "").join("\n") + "\n";
}
