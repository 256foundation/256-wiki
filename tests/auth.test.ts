/** Identity tests: signed sessions, NIP-98 Nostr auth, Turnstile gating. */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { issueSession, verifySession, subjectKey, sessionEnabled } from "../server/session";
import { verifyNostrAuth } from "../server/nostr";
import { handleAsk } from "../server/ask";
import { memoryStore } from "../server/store";
import { buildIndex } from "../lib/retrieval";
import type { KnowledgePack } from "../lib/pack";

// ── sessions ─────────────────────────────────────────────────────────────────

describe("sessions", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-0123456789abcdef";
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("round-trips a signed session", () => {
    const token = issueSession({ sub: "github:1234", tier: "user", name: "tyler", via: "github" });
    const s = verifySession(token);
    expect(s).not.toBeNull();
    expect(s?.sub).toBe("github:1234");
    expect(s?.tier).toBe("user");
    expect(s?.via).toBe("github");
  });

  it("rejects tampered payloads and bad signatures", () => {
    const token = issueSession({ sub: "github:1234", tier: "user", name: "tyler", via: "github" });
    const [body, sig] = token.split(".");
    expect(verifySession(`${body}.${sig.slice(0, -2)}xx`)).toBeNull(); // bad sig
    const forged = Buffer.from(
      JSON.stringify({ sub: "github:9999", tier: "team", name: "evil", via: "github", exp: Math.floor(Date.now() / 1000) + 999 }),
    ).toString("base64url");
    expect(verifySession(`${forged}.${sig}`)).toBeNull(); // payload swapped, sig kept
  });

  it("rejects expired sessions", () => {
    process.env.SESSION_SECRET = "test-secret";
    const token = issueSession({ sub: "x", tier: "user", name: "x", via: "dev" }, -1); // already expired
    expect(verifySession(token)).toBeNull();
  });

  it("is disabled without SESSION_SECRET (anon-only dev mode)", () => {
    delete process.env.SESSION_SECRET;
    expect(sessionEnabled()).toBe(false);
    expect(verifySession("whatever")).toBeNull();
  });

  it("subjectKey is stable and opaque", () => {
    expect(subjectKey("github:1234")).toBe(subjectKey("github:1234"));
    expect(subjectKey("github:1234")).not.toBe("github:1234");
    expect(subjectKey("github:1234")).not.toBe(subjectKey("github:5678"));
  });
});

// ── NIP-98 Nostr ─────────────────────────────────────────────────────────────

describe("verifyNostrAuth", () => {
  it("accepts a properly signed NIP-98 event", async () => {
    const { buildSignedNostrEvent } = await import("./helpers/nostr-helper");
    const ev = await buildSignedNostrEvent({
      url: "https://wiki.256foundation.org/api/auth/nostr",
      method: "POST",
    });
    const out = await verifyNostrAuth(ev, "https://wiki.256foundation.org");
    expect(out.ok).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { buildSignedNostrEvent } = await import("./helpers/nostr-helper");
    const ev = await buildSignedNostrEvent({ url: "https://wiki.256foundation.org/x", method: "POST" });
    ev.sig = ev.sig.slice(0, -4) + "0000";
    const out = await verifyNostrAuth(ev, "https://wiki.256foundation.org");
    expect(out.ok).toBe(false);
  });

  it("rejects stale events and wrong origin/method", async () => {
    const { buildSignedNostrEvent } = await import("./helpers/nostr-helper");
    const stale = await buildSignedNostrEvent({ url: "https://wiki.256foundation.org/x", method: "POST", skewSeconds: 3600 });
    expect((await verifyNostrAuth(stale, "https://wiki.256foundation.org")).ok).toBe(false);
    const wrongOrigin = await buildSignedNostrEvent({ url: "https://evil.example.com/x", method: "POST" });
    expect((await verifyNostrAuth(wrongOrigin, "https://wiki.256foundation.org")).ok).toBe(false);
    const wrongMethod = await buildSignedNostrEvent({ url: "https://wiki.256foundation.org/x", method: "GET" });
    expect((await verifyNostrAuth(wrongMethod, "https://wiki.256foundation.org")).ok).toBe(false);
  });
});

// ── ask + identity integration ───────────────────────────────────────────────

const miniPack = {
  meta: { version: 1, contentHash: "sha256:abcdef1234567890", generated: "2026-01-01", pageCount: 1 },
  pages: [
    {
      slug: "fpps", topic: "pools", title: "FPPS", summary: "Payout scheme.",
      updated: null, asOf: "2026-01-01", statuses: [], sources: [], rawLinks: [], backlinks: [],
      body: "FPPS pays the full block reward plus average transaction fees per share.",
    } as KnowledgePack["pages"][number],
  ],
} as unknown as KnowledgePack;

describe("ask + identity", () => {
  const restoreEnv: Array<[string, string | undefined]> = [];
  const setEnv = (k: string, v: string | undefined) => {
    restoreEnv.push([k, process.env[k]]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };

  beforeEach(() => {
    restoreEnv.length = 0;
    setEnv("LLM_API_KEY", "test-key");
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ model: "mock/x", choices: [{ message: { content: "a" } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
  });
  afterEach(() => {
    while (restoreEnv.length) {
      const [k, v] = restoreEnv.pop() as [string, string | undefined];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("identified users skip Turnstile even when a secret is configured", async () => {
    setEnv("TURNSTILE_SECRET", "real-secret");
    setEnv("LLM_MODEL", "mock/x");
    const store = memoryStore();
    const index = buildIndex(miniPack);
    // signed-in, no token → passes (Turnstile skipped)
    const ok = await handleAsk(store, index, { question: "how does fpps pay fees?" }, {
      ip: null, tier: "user", identified: true, subjectKey: "abc123",
    });
    expect(ok.ok).toBe(true);
    // anon, no token → 403 turnstile-failed
    const anon = await handleAsk(store, index, { question: "how does fpps pay fees?" }, { ip: "1.2.3.4" });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.status).toBe(403);
  });

  it("identified users draw from their own quota bucket (not the IP's)", async () => {
    setEnv("LLM_MODEL", "mock/x");
    setEnv("ANON_DAILY_QUOTA", "1");
    setEnv("SIGNEDIN_DAILY_QUOTA", "3");
    delete process.env.TURNSTILE_SECRET;
    const store = memoryStore();
    const index = buildIndex(miniPack);
    const q = (n: number) => `distinct question number ${n} about fpps fees?`;
    // anon burns the IP bucket
    expect((await handleAsk(store, index, { question: q(1) }, { ip: "2.2.2.2" })).ok).toBe(true);
    expect((await handleAsk(store, index, { question: q(2) }, { ip: "2.2.2.2" })).ok).toBe(false);
    // same IP-but-signed-in has a fresh, larger bucket
    for (let n = 3; n <= 5; n += 1) {
      const out = await handleAsk(store, index, { question: q(n) }, { ip: "2.2.2.2", tier: "user", identified: true, subjectKey: "key1" });
      expect(out.ok).toBe(true);
    }
    const exhausted = await handleAsk(store, index, { question: q(6) }, { ip: "2.2.2.2", tier: "user", identified: true, subjectKey: "key1" });
    expect(exhausted.ok).toBe(false);
    if (!exhausted.ok) expect((exhausted.body as { limit: number }).limit).toBe(3);
  });
});
