import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

/** GET /api/pack.json — the entire knowledge pack (~3MB) for agents that want
 * to work offline: schema-versioned, content-hashed, one fetch, no crawling. */
export async function GET() {
  const pack = await loadPack();
  return Response.json(pack, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
