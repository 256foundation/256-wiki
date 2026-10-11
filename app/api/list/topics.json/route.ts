import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

/** GET /api/list/topics.json — topic directory with counts (agent orientation). */
export async function GET() {
  const pack = await loadPack();
  const counts = new Map<string, number>();
  for (const p of pack.pages) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
  return Response.json(
    {
      meta: pack.meta,
      topics: pack.topics.map((t) => ({
        name: t.name,
        description: t.description,
        count: counts.get(t.name) ?? 0,
        url: `https://wiki.256foundation.org/topics/${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/`,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
