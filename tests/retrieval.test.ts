import { describe, it, expect } from "vitest";
import { chunkBody, tokenize, buildIndex, retrieve, makeSnippet } from "@/lib/retrieval";
import type { KnowledgePack } from "@/lib/pack";

describe("tokenize", () => {
  it("keeps decimal numbers and unit-ish tokens", () => {
    expect(tokenize("473 TH/s @ 12 J/T (35℃)")).toContain("473");
    expect(tokenize("Braiins OS 23.09")).toContain("23.09");
  });
  it("drops stopwords and single chars", () => {
    expect(tokenize("the a of x")).toEqual([]);
  });
});

describe("chunkBody", () => {
  it("splits long bodies into ~300-token windows", () => {
    const paras = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ` + "hashrate power efficiency ".repeat(30));
    const chunks = chunkBody(paras.join("\n\n"));
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(tokenize(c.text).length).toBeLessThanOrEqual(300 + 300); // window + one para overshoot
    }
  });
  it("returns a single chunk for short bodies", () => {
    expect(chunkBody("short body")).toEqual([{ text: "short body", start: 0 }]);
  });
});

const miniPack: KnowledgePack = {
  meta: { version: 1, generated: "2026-10-11T00:00:00Z", contentHash: "sha256:x", sourceCommit: null, pageCount: 3, topicCount: 2 },
  topics: [
    { id: "hardware", name: "Hardware", description: "" },
    { id: "pools", name: "Pools", description: "" },
  ],
  pages: [
    {
      slug: "antminer-s21-xp-hyd",
      topic: "hydro",
      title: "Antminer S21 XP Hyd",
      summary: "Hydro flagship, 473 TH/s, 12 J/T.",
      updated: "2026-10-10",
      asOf: "2026-10-10",
      statuses: ["disputed"],
      sources: [],
      rawLinks: [],
      backlinks: [],
      body: "The S21 XP Hyd is a hydro-cooled ASIC with 473 TH/s typical hashrate at 12 J/T efficiency.\n\nHydro loop requires 8.0~10.0 L/min coolant flow.",
    } as never,
    {
      slug: "fpps",
      topic: "pools",
      summary: "Full pay per share payout scheme.",
      title: "FPPS",
      updated: null,
      asOf: null,
      statuses: [],
      sources: [],
      rawLinks: [],
      backlinks: [],
      body: "FPPS is a pool payout scheme that pays full block reward plus transaction fees per share.\n\nPool fees under FPPS are typically 1-2%.",
    } as KnowledgePack["pages"][number],
    {
      slug: "stratum-v2",
      topic: "pools",
      title: "Stratum V2",
      summary: "Next-gen mining protocol with job negotiation.",
      updated: null,
      asOf: null,
      statuses: [],
      sources: [],
      rawLinks: [],
      backlinks: [],
      body: "Stratum V2 lets miners build their own block templates via job negotiation.",
    } as KnowledgePack["pages"][number],
  ],
} as unknown as KnowledgePack;

describe("buildIndex + retrieve", () => {
  const index = buildIndex(miniPack as KnowledgePack);

  it("indexes chunks for every page", () => {
    const slugs = new Set(index.chunks.map((c) => c.slug));
    expect(slugs).toEqual(new Set(["antminer-s21-xp-hyd", "fpps", "stratum-v2"]));
  });

  it("ranks the hydro page first for a hydro query", () => {
    const hits = retrieve(index, "hydro cooled ASIC efficiency");
    expect(hits[0]?.slug).toBe("antminer-s21-xp-hyd");
  });

  it("ranks FPPS first for a pool payout query", () => {
    const hits = retrieve(index, "FPPS pool fees payout");
    expect(hits[0]?.slug).toBe("fpps");
  });

  it("respects the topic filter", () => {
    const hits = retrieve(index, "hashrate", { topic: "pools" });
    expect(hits.every((h) => h.topic === "pools")).toBe(true);
  });

  it("returns empty for stopword-only queries", () => {
    expect(retrieve(index, "the a of")).toEqual([]);
  });

  it("carries statuses through to hits", () => {
    const hits = retrieve(index, "hydro");
    expect(hits[0]?.statuses).toContain("disputed");
  });

  it("snippets contain an ellipsis for long text", () => {
    const s = makeSnippet("word ".repeat(400) + "needle here " + "word ".repeat(100), ["needle"]);
    expect(s).toContain("needle");
  });
});
