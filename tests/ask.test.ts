import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memoryStore, dayKey, qhashOf } from "../server/store";
import { handleAsk, answerIdFor, ipHashOf } from "../server/ask";
import { buildIndex } from "../lib/retrieval";
import type { KnowledgePack } from "../lib/pack";

// ── mini pack (same shape the real pack has) ─────────────────────────────────

const miniPack = {
  meta: { version: 1, contentHash: "sha256:abcdef1234567890", generated: "2026-01-01", pageCount: 2 },
  pages: [
    {
      slug: "fpps",
      topic: "pools",
      title: "FPPS",
      summary: "Full pay-per-share payout scheme.",
      updated: null,
      asOf: "2026-01-01",
      statuses: [],
      sources: [],
      rawLinks: [],
      backlinks: [],
      body: "FPPS pays the full block reward plus average transaction fees per share. Pool fees are typically one to two percent.",
    } as KnowledgePack["pages"][number],
    {
      slug: "stratum-v2",
      topic: "protocols",
      title: "Stratum V2",
      summary: "Next-gen mining protocol.",
      updated: null,
      asOf: null,
      statuses: ["Disputed"],
      sources: [],
      rawLinks: [],
      backlinks: [],
      body: "Stratum V2 lets miners build their own block templates via job negotiation.",
    } as KnowledgePack["pages"][number],
  ],
} as unknown as KnowledgePack;

// ── stub LLM (global fetch → canned OpenAI-shaped response) ──────────────────

let fetchCalls = 0;
let usage = { prompt_tokens: 100, completion_tokens: 50 };

function stubFetch(ok = true) {
  fetchCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    fetchCalls += 1;
    if (!ok) return new Response("{}", { status: 500 });
    return new Response(
      JSON.stringify({
        model: "mock/mini",
        choices: [{ message: { content: "Grounded answer citing [FPPS](/pages/fpps)." } }],
        usage,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const index = buildIndex(miniPack);
const restoreEnv: Array<[string, string | undefined]> = [];

function setEnv(k: string, v: string | undefined) {
  restoreEnv.push([k, process.env[k]]);
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

describe("handleAsk", () => {
  let store: ReturnType<typeof memoryStore>;
  let unstub: () => void;

  beforeEach(() => {
    store = memoryStore();
    setEnv("LLM_API_KEY", "test-key");
    setEnv("LLM_MODEL", "mock/primary");
    setEnv("LLM_FALLBACK_MODEL", "mock/fallback");
    setEnv("ANON_DAILY_QUOTA", "2");
    delete process.env.LLM_DAILY_TOKEN_BUDGET;
    delete process.env.TURNSTILE_SECRET;
    unstub = stubFetch();
  });

  afterEach(() => {
    unstub();
    while (restoreEnv.length) {
      const [k, v] = restoreEnv.pop() as [string, string | undefined];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("rejects empty questions", async () => {
    const out = await handleAsk(store, index, { question: "  " }, { ip: "1.2.3.4" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });

  it("answers from the LLM with citations and spends quota", async () => {
    const out = await handleAsk(store, index, { question: "How does FPPS pay transaction fees?" }, { ip: "1.2.3.4" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      const body = out.body as unknown as { answerHtml: string; citations: unknown[]; quotaRemaining: number; cached: boolean };
      expect(body.citations.length).toBeGreaterThan(0);
      expect(body.citations[0]).toHaveProperty("slug", "fpps");
      expect(body.cached).toBe(false);
      expect(body.answerHtml).toContain("<a");
    }
    expect(fetchCalls).toBe(1);
    expect(await store.peekQuota(`anon#${ipHashOf("1.2.3.4")}`, dayKey())).toBe(1);
  });

  it("serves repeat questions from cache without quota or LLM cost", async () => {
    const q = "how does stratum v2 job negotiation work?";
    await handleAsk(store, index, { question: q }, { ip: "5.6.7.8" });
    const first = fetchCalls;
    const out = await handleAsk(store, index, { question: "  HOW does stratum v2 job negotiation WORK?  " }, { ip: "5.6.7.8" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      const body = out.body as unknown as { cached: boolean; quotaRemaining: number };
      expect(body.cached).toBe(true); // case/whitespace normalization hits the cache
      expect(body.quotaRemaining).toBe(1); // one spent total
    }
    expect(fetchCalls).toBe(first); // no second LLM call
    expect(await store.peekQuota(`anon#${ipHashOf("5.6.7.8")}`, dayKey())).toBe(1);
    void first;
  });

  it("answers gap questions for free and logs them", async () => {
    const out = await handleAsk(store, index, { question: "what is the moon made of mining wise zzz" }, { ip: "9.9.9.9" });
    expect(out.ok).toBe(true);
    expect(fetchCalls).toBe(0); // no LLM spend on ungroundable questions
    if (out.ok) {
      const body = out.body as unknown as { answer: string; citations: unknown[]; model: string };
      expect(body.answer).toContain("doesn't know");
      expect(body.citations).toEqual([]);
      expect(body.model).toBe("none");
    }
    expect(store.logRows.length).toBe(1);
    expect(store.logRows[0].topSlugs).toEqual([]);
  });

  it("enforces the daily quota with a 429 that points at the agent path", async () => {
    setEnv("ANON_DAILY_QUOTA", "1");
    const ip = "7.7.7.7";
    const first = await handleAsk(store, index, { question: "how does fpps pay fees" }, { ip });
    expect(first.ok).toBe(true);
    const second = await handleAsk(store, index, { question: "what does stratum v2 do for templates" }, { ip });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(429);
      expect(second.body.error).toBe("quota-exceeded");
      expect(String(second.body.message)).toContain("agent");
    }
  });

  it("trips the global token breaker when the daily budget is spent", async () => {
    setEnv("LLM_DAILY_TOKEN_BUDGET", "10"); // first call (150 tokens) blows past it
    const ip = "8.8.8.8";
    const first = await handleAsk(store, index, { question: "how does fpps pay fees" }, { ip });
    expect(first.ok).toBe(true);
    if (first.ok) expect((first.body as unknown as { breakerTripped: boolean }).breakerTripped).toBe(true);
    const second = await handleAsk(store, index, { question: "what does stratum v2 change" }, { ip });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(429);
      expect(second.body.error).toBe("breaker-tripped");
    }
  });

  it("returns 503 when no LLM key is configured (retrieval still works)", async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const out = await handleAsk(store, index, { question: "how does fpps pay fees" }, { ip: "2.2.2.2" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(503);
  });

  it("falls back to the second model when the primary fails", async () => {
    unstub();
    let calls = 0;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      calls += 1;
      const model = (JSON.parse(String(init?.body)) as { model: string }).model;
      if (model === "mock/primary") return new Response("boom", { status: 429 });
      return new Response(
        JSON.stringify({
          model: "mock/fallback",
          choices: [{ message: { content: "fallback answer" } }],
          usage,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const out = await handleAsk(store, index, { question: "how does fpps pay fees" }, { ip: "3.3.3.3" });
    expect(calls).toBe(2);
    expect(out.ok).toBe(true);
    if (out.ok) {
      const body = out.body as unknown as { model: string };
      expect(body.model).toBe("mock/fallback");
    }
  });
});

describe("helpers", () => {
  it("qhashOf normalizes case and whitespace", () => {
    expect(qhashOf("What's FPPS?")).toBe(qhashOf("  what's   fpps? "));
    expect(qhashOf("a")).not.toBe(qhashOf("b"));
  });

  it("answerIdFor versions by pack hash", () => {
    expect(answerIdFor("abc", "sha256:1234567890abcdef")).toMatch(/^abc\.1234567890$/);
  });

  it("ipHashOf is stable and hashes", () => {
    expect(ipHashOf("1.2.3.4")).toBe(ipHashOf("1.2.3.4"));
    expect(ipHashOf("1.2.3.4")).not.toBe("1.2.3.4");
    expect(ipHashOf(null)).toBe("unknown");
  });
});
