/** The ask pipeline — the product. (plan §3, Phase 2)
 *
 *   question → Turnstile → cache? → breaker? → retrieve → LLM →
 *   answer + citations → cache + query-log (+ token budget bump)
 *
 * Cache hits cost nothing (no quota, no tokens). Quota misses are honest 429s
 * that always point at the unlimited path: connect your own agent.
 * Zero-retrieval questions are logged as gaps and answered for free (no LLM
 * spend on questions the brain can't ground).
 */

import { retrieve, type RetrievalIndex } from "../lib/retrieval";
import { marked } from "marked";
import { pack } from "./pack";
import { chatComplete, answerSystemPrompt, contextBlock, llmConfigured } from "./llm";
import { verifyTurnstile } from "./turnstile";
import { dayKey, qhashOf, sha256Hex, type Store, type AnswerRow } from "./store";

const MAX_QUESTION = 2000;
const RETRIEVAL_LIMIT = 6;
/** below this BM25 score a question "didn't really match" — treat as a gap */
const ASK_MIN_SCORE = 1.0;

const GAP_ANSWER =
  "**The brain doesn't know this yet.**\n\nNothing in the current knowledge pack answers that question. This is exactly what the [open gaps](/gaps) board tracks — if you know a source that would close the gap, [suggest it](/contribute) and the next ingest loop will pick it up.";

export interface AskAnswer {
  answerId: string;
  permalink: string;
  question: string;
  answer: string; // markdown
  answerHtml: string; // pre-rendered; the client just injects it
  citations: Array<{ slug: string; title: string; asOf: string | null; url: string }>;
  cached: boolean;
  quotaRemaining: number | null;
  model: string;
  breakerTripped: boolean;
  packHash: string;
}

export type AskOutcome =
  | { ok: true; body: AskAnswer }
  | { ok: false; status: number; body: Record<string, unknown> };

export function ipHashOf(ip: string | null): string {
  if (!ip) return "unknown";
  return sha256Hex(ip).slice(0, 16);
}

export function answerIdFor(qhash: string, packHash: string): string {
  return `${qhash}.${packHash.replace(/^sha256:/, "").slice(0, 10)}`;
}

function quotaLimitFor(tier: string): number {
  if (tier === "team") return Number.MAX_SAFE_INTEGER;
  if (tier === "user") return Number(process.env.SIGNEDIN_DAILY_QUOTA || 25);
  return Number(process.env.ANON_DAILY_QUOTA || 5);
}

export async function handleAsk(
  store: Store,
  searchIndex: RetrievalIndex,
  input: {
    question?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    turnstileToken?: string;
  },
  ctx: { ip: string | null; tier?: string; identified?: boolean; subjectKey?: string },
): Promise<AskOutcome> {
  const tier = ctx.tier || "anon";
  const quotaKey = ctx.identified && ctx.subjectKey ? `${tier}#${ctx.subjectKey}` : `${tier}#${ipHashOf(ctx.ip)}`;
  const question = (input.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) {
    return { ok: false, status: 400, body: { error: "empty-question" } };
  }

  // 1. Turnstile — anonymous path only; identified users skip it
  if (!ctx.identified) {
    const ts = await verifyTurnstile(input.turnstileToken, ctx.ip);
    if (!ts.ok) {
      return { ok: false, status: 403, body: { error: "turnstile-failed", detail: ts.errors ?? [] } };
    }
  }

  // 2. Answer cache — versioned by pack hash; stale rows regenerate.
  const qhash = qhashOf(question);
  const cached = await store.getAnswer(qhash);
  if (cached && cached.packHash === pack.meta.contentHash && !input.history?.length) {
    const peeked = await store.peekQuota(quotaKey, dayKey());
    return {
      ok: true,
      body: {
        ...toAnswer(cached, pack.meta.contentHash),
        cached: true,
        quotaRemaining: Math.max(0, quotaLimitFor(tier) - peeked),
      },
    };
  }

  // 3. Global token budget (circuit breaker)
  const budgetCap = Number(process.env.LLM_DAILY_TOKEN_BUDGET || 3_000_000);
  const budget = await store.getBudget(dayKey());
  if (budget >= budgetCap) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "breaker-tripped",
        message:
          "The foundation-funded token budget for today is spent. The agent paths are unlimited: connect your own agent — search, pages, and MCP retrieval are free.",
      },
    };
  }

  // 4. Retrieval (free — CPU only). Zero-hit questions are logged as gaps and
  //    answered honestly WITHOUT burning quota or tokens. minScore floors
  //    one-common-word matches: an ask must actually retrieve, or it's a gap.
  const hits = retrieve(searchIndex, question, { limit: RETRIEVAL_LIMIT, minScore: ASK_MIN_SCORE });
  if (!hits.length) {
    await store.logQuery({
      id: `${Date.now()}-${qhash.slice(0, 8)}`,
      qhash,
      question,
      cached: false,
      breakerTripped: false,
      topSlugs: [],
      topScores: [],
      packHash: pack.meta.contentHash,
      tokensPrompt: 0,
      tokensCompletion: 0,
      model: "none",
      tier,
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + 180 * 86400,
    });
    const peeked = await store.peekQuota(quotaKey, dayKey());
    return {
      ok: true,
      body: {
        answerId: answerIdFor(qhash, pack.meta.contentHash),
        permalink: `/a/${answerIdFor(qhash, pack.meta.contentHash)}`,
        question,
        answer: GAP_ANSWER,
        answerHtml: marked.parse(GAP_ANSWER) as string,
        citations: [],
        cached: false,
        quotaRemaining: Math.max(0, quotaLimitFor(tier) - peeked),
        model: "none",
        breakerTripped: false,
        packHash: pack.meta.contentHash,
      },
    };
  }

  // 5. Quota — one per generated answer (cache hits and gaps skip this)
  const used = await store.bumpQuota(quotaKey, dayKey(), quotaLimitFor(tier));
  if (used === null) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "quota-exceeded",
        limit: quotaLimitFor(tier),
        tier,
        message:
          "Daily free answers used up. The agent path is unlimited: connect your own agent via /mcp — search, pages, and MCP retrieval cost nothing.",
      },
    };
  }
  const quotaRemaining = Math.max(0, quotaLimitFor(tier) - used);

  // 6. LLM
  if (!llmConfigured()) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "llm-not-configured",
        message:
          "No LLM key configured (LLM_API_KEY). Retrieval works — try GET /api/search?q= — or connect your own agent via /mcp.",
      },
    };
  }

  const messages = [
    { role: "system" as const, content: answerSystemPrompt() },
    ...(input.history ?? []).slice(-6),
    {
      role: "user" as const,
      content: `${question}\n\n---\nCONTEXT (wiki excerpts; cite these, never invent sources):\n\n${contextBlock(
        hits.map((h) => ({ slug: h.slug, title: h.title, asOf: h.asOf, statuses: h.statuses, text: h.text })),
      )}`,
    },
  ];

  let llm;
  try {
    llm = await chatComplete(messages);
  } catch (err) {
    return {
      ok: false,
      status: 502,
      body: { error: "llm-failed", detail: (err as Error).message?.slice(0, 200) },
    };
  }

  // 7. Persist + log
  const answerId = answerIdFor(qhash, pack.meta.contentHash);
  const citations = hits.map((h) => ({
    slug: h.slug,
    title: h.title,
    asOf: h.asOf,
    url: `https://wiki.256foundation.org/pages/${h.slug}/`,
  }));
  const answerHtml = marked.parse(llm.text) as string;
  const row: AnswerRow = {
    answerId: answerIdFor(qhash, pack.meta.contentHash),
    qhash,
    question,
    answer: llm.text,
    citations,
    model: llm.model,
    packHash: pack.meta.contentHash,
    thread: input.history?.length ? qhashOf(input.history[0]?.content ?? question) : null,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 90 * 86400,
  };
  await store.putAnswer(row);

  const logRow = {
    id: `${Date.now()}-${qhash.slice(0, 8)}`,
    qhash,
    question,
    cached: false,
    breakerTripped: false,
    topSlugs: hits.map((h) => h.slug),
    topScores: hits.map((h) => h.score),
    packHash: pack.meta.contentHash,
    tokensPrompt: llm.promptTokens,
    tokensCompletion: llm.completionTokens,
    model: llm.model,
    tier,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 180 * 86400,
  };
  await store.logQuery(logRow);

  const breaker = await store.bumpBudget(
    dayKey(),
    llm.promptTokens + llm.completionTokens,
    budgetCap,
  );

  return {
    ok: true,
    body: {
      answerId: row.answerId,
      permalink: `/a/${row.answerId}`,
      question,
      answer: llm.text,
      answerHtml,
      citations,
      cached: false,
      quotaRemaining,
      model: llm.model,
      breakerTripped: breaker.tripped,
      packHash: pack.meta.contentHash,
    },
  };
}

function toAnswer(row: AnswerRow, packHash: string): AskAnswer {
  return {
    answerId: row.answerId,
    permalink: `/a/${row.answerId}`,
    question: row.question,
    answer: row.answer,
    answerHtml: marked.parse(row.answer) as string,
    citations: row.citations,
    cached: true,
    quotaRemaining: null,
    model: row.model,
    breakerTripped: false,
    packHash,
  };
}
