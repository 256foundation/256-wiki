import { describe, it, expect } from "vitest";
import { splitStatusBlocks, resolveWikiLinks } from "@/lib/epistemics";
import { hasStatus, isDisputed, isOutdated, pagesByTopic, rawLinkUrl, type PackPage } from "@/lib/pack";

const sampleBody = `Intro paragraph.

## Specs

- 473 TH/s

> **Status: Disputed** (price)
> Specs agree but prices do not: 8041 USD maker vs $6,629 AMV.
> Second line of the dispute.

Trailing paragraph.

> **Status: Outdated** (2026-08-21)
> What changed, with attribution.`;

describe("splitStatusBlocks", () => {
  it("pulls status blocks out of the body as segments", () => {
    const segs = splitStatusBlocks(sampleBody);
    expect(segs.map((s) => s.kind)).toEqual(["markdown", "status", "markdown", "status"]);
  });

  it("captures status kind, qualifier and full blockquote body", () => {
    const segs = splitStatusBlocks(sampleBody);
    const disputed = segs[1];
    expect(disputed).toMatchObject({ kind: "status", status: "Disputed", qualifier: "price" });
    if (disputed.kind === "status") {
      expect(disputed.body).toContain("prices do not");
      expect(disputed.body).toContain("AMV");
    }
    const outdated = segs[3];
    expect(outdated).toMatchObject({ kind: "status", status: "Outdated", qualifier: "2026-08-21" });
  });

  it("keeps the em-dash qualifier form used across the wiki", () => {
    const segs = splitStatusBlocks("> **Status: Disputed** — 51% attack feasibility\n> Claim A vs claim B.");
    expect(segs[0]).toMatchObject({ kind: "status", status: "Disputed", qualifier: "51% attack feasibility" });
  });

  it("passes through bodies without status blocks untouched", () => {
    expect(splitStatusBlocks("just markdown\n\nmore")).toEqual([
      { kind: "markdown", text: "just markdown\n\nmore" },
    ]);
  });
});

describe("resolveWikiLinks", () => {
  it("rewrites same-topic article links to /pages/<slug>", () => {
    expect(resolveWikiLinks("[Other](other-article.md)", "hardware")).toBe("[Other](/pages/other-article)");
  });

  it("rewrites cross-topic links", () => {
    expect(resolveWikiLinks("[X](../pools/fpps.md)", "pools")).toBe("[X](/pages/fpps)");
  });

  it("leaves raw-capture links for the provenance handler", () => {
    expect(resolveWikiLinks("[cap](../../raw/hardware/bitmain/a.md)", "hardware")).toBe(
      "[cap](../../raw/hardware/bitmain/a.md)",
    );
  });

  it("preserves heading fragments", () => {
    expect(resolveWikiLinks("[X](other.md#specs)", "hardware")).toBe("[X](/pages/other#specs)");
  });
});

const page = (over: Partial<PackPage>): PackPage => ({
  slug: "x",
  topic: "hardware",
  title: "X",
  summary: "",
  updated: null,
  asOf: null,
  statuses: [],
  sources: [],
  rawLinks: [],
  backlinks: [],
  body: "",
  ...over,
});

describe("status helpers", () => {
  it("detects disputed / outdated", () => {
    expect(isDisputed(page({ statuses: ["draft", "disputed"] }))).toBe(true);
    expect(isDisputed(page({ statuses: ["draft"] }))).toBe(false);
    expect(isOutdated(page({ statuses: ["outdated"] }))).toBe(true);
  });

  it("matches prefixed statuses like 'disputed — resolved'", () => {
    expect(hasStatus(page({ statuses: ["disputed — resolved"] }), "disputed")).toBe(true);
  });
});

describe("rawLinkUrl", () => {
  it("maps repo-relative raw links to GitHub blob URLs", () => {
    expect(rawLinkUrl("raw/hardware/bitmain/x.md")).toBe(
      "https://github.com/256foundation/public-mining-brain/blob/main/raw/hardware/bitmain/x.md",
    );
  });
});

describe("pagesByTopic", () => {
  it("groups pages and tolerates unknown topics", () => {
    const pack = {
      meta: {
        version: 1,
        generated: "2026-10-11T00:00:00Z",
        contentHash: "sha256:x",
        sourceCommit: null,
        pageCount: 2,
        topicCount: 2,
      },
      topics: [{ id: "hardware", name: "Hardware", description: "" }],
      pages: [page({ slug: "a", topic: "hardware" }), page({ slug: "b", topic: "pools" })],
    };
    const map = pagesByTopic(pack);
    expect(map.get("hardware")).toHaveLength(1);
    expect(map.get("pools")).toHaveLength(1);
  });
});
