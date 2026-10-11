/** Server retrieval over the knowledge pack — pure TS, zero deps.
 *
 * Plan §3: chunked index (~300-token windows with title+summary boost) is
 * plenty at ~100 pages; embeddings are a later drop-in behind the same
 * retrieve(q) interface. BM25 over chunks; a light prior boosts chunks whose
 * page title/summary match. Used by /api/search and the ask pipeline.
 */

import type { KnowledgePack, PackPage } from "./pack";

export interface Chunk {
  slug: string;
  topic: string;
  title: string;
  summary: string;
  asOf: string | null;
  statuses: string[];
  text: string; // the chunk content (markdown, spec-protected not needed here)
  start: number; // char offset in body
  tokens: string[];
  tf: Map<string, number>;
  length: number;
}

export interface RetrievalIndex {
  chunks: Chunk[];
  df: Map<string, number>; // document (chunk) frequency per token
  avgLen: number;
  pageBySlug: Map<string, PackPage>;
}

export interface RetrievalHit {
  slug: string;
  topic: string;
  title: string;
  snippet: string;
  score: number;
  asOf: string | null;
  statuses: string[];
}

const CHUNK_TOKENS = 300;
const CHUNK_OVERLAP = 40;
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was",
  "be", "as", "at", "by", "it", "this", "that", "from", "vs", "per", "not", "no", "yes",
  "what", "how", "does", "do", "can", "will", "which", "when", "why", "should", "about",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.℃°+#]+/) // keep decimal numbers, ℃, °, chip names (s21, bm1366)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** ~300-token windows with overlap; splits on paragraph boundaries when close. */
export function chunkBody(body: string): Array<{ text: string; start: number }> {
  const paragraphs = body.split(/\n\n+/);
  const chunks: Array<{ text: string; start: number }> = [];
  let current: string[] = [];
  let currentLen = 0;
  let start = 0;
  let pos = 0;

  for (const para of paragraphs) {
    const paraTokens = tokenize(para).length;
    if (currentLen > 0 && currentLen + paraTokens > CHUNK_TOKENS) {
      chunks.push({ text: current.join("\n\n"), start });
      // overlap: keep the tail of the current window
      const tail: string[] = [];
      let tailLen = 0;
      for (let i = current.length - 1; i >= 0 && tailLen < CHUNK_OVERLAP; i -= 1) {
        tail.unshift(current[i]);
        tailLen += tokenize(current[i]).length;
      }
      current = tail;
      currentLen = tailLen;
      start = pos - current.join("\n\n").length;
    }
    if (!current.length) start = pos;
    current.push(para);
    currentLen += paraTokens;
    pos += para.length + 2;
  }
  if (current.length) chunks.push({ text: current.join("\n\n"), start });
  return chunks.length ? chunks : [{ text: body, start: 0 }];
}

export function buildIndex(pack: KnowledgePack): RetrievalIndex {
  const chunks: Chunk[] = [];
  for (const page of pack.pages) {
    const parts = chunkBody(page.body);
    const preface = [page.title, page.summary].filter(Boolean).join(" ");
    for (const part of parts) {
      const text = part.text;
      const tokens = [...tokenize(preface), ...tokenize(text)];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      chunks.push({
        slug: page.slug,
        topic: page.topic,
        title: page.title,
        summary: page.summary,
        asOf: page.asOf,
        statuses: page.statuses,
        text,
        start: part.start,
        tokens,
        tf,
        length: tokens.length,
      });
    }
  }
  const df = new Map<string, number>();
  for (const c of chunks) {
    for (const t of new Set(c.tf.keys())) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const avgLen = chunks.reduce((s, c) => s + c.length, 0) / Math.max(1, chunks.length);
  return { chunks, df, avgLen, pageBySlug: new Map(pack.pages.map((p) => [p.slug, p])) };
}

const K1 = 1.4;
const B = 0.75;

/** BM25 over chunks + title/summary boost + As-Of recency tiebreak. */
export function retrieve(index: RetrievalIndex, query: string, opts: { limit?: number; topic?: string } = {}): RetrievalHit[] {
  const limit = opts.limit ?? 8;
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const N = index.chunks.length;

  const scored = index.chunks
    .filter((c) => !opts.topic || c.topic === opts.topic)
    .map((c) => {
      let score = 0;
      const seen = new Set<string>();
      for (const q of qTokens) {
        if (seen.has(q)) continue;
        seen.add(q);
        const f = c.tf.get(q);
        if (!f) continue;
        const n = index.df.get(q) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (c.length / index.avgLen))));
      }
      return { chunk: c, score };
    })
    .filter((x) => x.score > 0);

  // boost chunks from pages whose title/summary match query terms
  for (const hit of scored) {
    const titleTokens = new Set(tokenize(hit.chunk.title));
    const summaryTokens = new Set(tokenize(hit.chunk.summary));
    let boost = 1;
    for (const q of new Set(qTokens)) {
      if (titleTokens.has(q)) boost += 0.6;
      else if (summaryTokens.has(q)) boost += 0.25;
    }
    hit.score *= boost;
  }

  scored.sort((a, b) => b.score - a.score);

  // one hit per page for the top list (page-level retrieval)
  const seenSlug = new Set<string>();
  const hits: RetrievalHit[] = [];
  for (const { chunk, score } of scored) {
    if (seenSlug.has(chunk.slug)) continue;
    seenSlug.add(chunk.slug);
    hits.push({
      slug: chunk.slug,
      topic: chunk.topic,
      title: chunk.title,
      snippet: makeSnippet(chunk.text, qTokens),
      score: Math.round(score * 1000) / 1000,
      asOf: chunk.asOf,
      statuses: chunk.statuses,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function makeSnippet(text: string, qTokens: string[], radius = 160): string {
  const lower = text.toLowerCase();
  let best = { pos: 0, matches: -1 };
  for (let i = 0; i < Math.max(1, lower.length - radius); i += Math.max(1, Math.floor(radius / 2))) {
    const matches = qTokens.reduce(
      (n, q) => n + (lower.slice(i, i + radius * 2).includes(q) ? 1 : 0),
      0,
    );
    if (matches > best.matches) best = { pos: i, matches };
  }
  const start = Math.max(0, best.pos - 40);
  let snippet = text.slice(start, start + radius * 2).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (start + radius * 2 < text.length) snippet += "…";
  return snippet;
}
