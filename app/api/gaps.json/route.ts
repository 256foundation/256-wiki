import { loadPack } from "@/lib/pack-loader";

export const dynamic = "force-static";

/** GET /api/gaps.json — public unanswered-questions board data.
 * Populated from the query-log once the ask pipeline is live (Phase 2/4);
 * until then the board is empty by design, not broken. */
export async function GET() {
  const pack = await loadPack();
  return Response.json(
    {
      meta: {
        packHash: pack.meta.contentHash,
        updated: pack.meta.generated,
        note: "gap data flows from the ask pipeline query log (weekly clustering); empty until Phase 2 launches",
      },
      gaps: [],
    },
    { headers: { "Cache-Control": "public, max-age=600", "Access-Control-Allow-Origin": "*" } },
  );
}
