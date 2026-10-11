/** Phase 4: gap clustering + the public board endpoint. */

import { describe, it, expect, beforeEach } from "vitest";
import { clusterGaps, isGapRow } from "../server/gaps";
import type { QueryLogRow } from "../server/store";
import { memoryStore, qhashOf } from "../server/store";
import { app } from "../server/app";

function gapRow(n: number, qhash: string, question: string, createdAt: string): QueryLogRow {
  return {
    id: `gap-${n}`,
    qhash,
    question,
    cached: false,
    breakerTripped: false,
    topSlugs: [],
    topScores: [],
    packHash: "sha256:test",
    tokensPrompt: 0,
    tokensCompletion: 0,
    model: "none",
    tier: "anon",
    createdAt,
    expiresAt: 0,
  };
}

describe("clusterGaps", () => {
  it("flags only ungrounded rows as gaps", () => {
    expect(isGapRow({ ...gapRow(0, "h", "q", "2026-01-01") })).toBe(true);
    expect(isGapRow({ ...gapRow(0, "h", "q", "2026-01-01"), model: "mock/haiku" })).toBe(false);
    expect(isGapRow({ ...gapRow(0, "h", "q", "2026-01-01"), cached: true })).toBe(false);
  });

  it("clusters identical qhashes, keeps newest wording, sorts by demand", () => {
    const a = qhashOf("who is the best pool");
    const b = qhashOf("why does difficulty adjust");
    const rows = [
      gapRow(1, a, "who is best pool", "2026-01-01T10:00:00Z"),
      gapRow(2, a, "who is the BEST pool??", "2026-01-03T10:00:00Z"),
      gapRow(3, a, "who is the best pool", "2026-01-02T10:00:00Z"),
      gapRow(4, b, "why difficulty", "2026-01-05T10:00:00Z"),
    ];
    const clusters = clusterGaps(rows);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].question).toBe("who is the BEST pool??"); // newest wording
    expect(clusters[0].lastAskedAt).toBe("2026-01-03T10:00:00Z");
    expect(clusters[0].firstAskedAt).toBe("2026-01-01T10:00:00Z");
    expect(clusters[1].count).toBe(1);
  });

  it("ignores non-gap rows mixed into the log", () => {
    const answered = { ...gapRow(9, qhashOf("fpps"), "fpps?", "2026-01-02"), model: "mock/haiku", topSlugs: ["fpps"] };
    expect(clusterGaps([answered, gapRow(2, qhashOf("zzz q"), "zzz q?", "2026-01-03")])).toHaveLength(1);
  });
});

describe("GET /api/gaps.json", () => {
  beforeEach(() => {
    // app-level store is the shared memory store (no tables in tests) —
    // seed it with a mix of gap and answered asks
  });

  it("serves clustered gaps from the live query log", async () => {
    // a couple of asks: one gibberish (gap), one answerable
    await app.request("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "flurbification quotient of wibble wobble zzz qqq" }),
    });
    const res = await app.request("/api/gaps.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stats: { gapAsks: number; distinctGaps: number };
      gaps: Array<{ question: string; count: number }>;
    };
    expect(body.stats.gapAsks).toBeGreaterThanOrEqual(1);
    expect(body.gaps.some((g) => /zzz/.test(g.question))).toBe(true);
    expect(res.headers.get("cache-control")).toContain("max-age=60");
  });
});
