/** Thin OpenAI-compatible LLM adapter (OpenRouter dedicated key).
 *
 * Config, not code: model names come from env. Primary → fallback on any
 * failure (rate limit, outage, timeout). Spends are logged per call so the
 * daily breaker (LLM_DAILY_TOKEN_BUDGET) can trip the UI to the
 * "connect your own agent" pitch.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  fallbackUsed: boolean;
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";

function env(name: string): string {
  return process.env[name] ?? "";
}

export function llmConfigured(): boolean {
  return Boolean(env("LLM_API_KEY") || env("OPENROUTER_API_KEY"));
}

async function callModel(model: string, messages: ChatMessage[], timeoutMs: number): Promise<LlmResult> {
  const key = env("LLM_API_KEY") || env("OPENROUTER_API_KEY");
  const base = env("LLM_BASE_URL") || DEFAULT_BASE;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // OpenRouter attribution headers (nice-to-have, per their docs)
        "HTTP-Referer": "https://wiki.256foundation.org",
        "X-Title": "256-wiki",
      },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.2 }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error("empty completion");
    return {
      text,
      model: body.model ?? model,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      fallbackUsed: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Primary model, then fallback. Throws only if both fail. */
export async function chatComplete(messages: ChatMessage[], timeoutMs = 28_000): Promise<LlmResult> {
  const primary = env("LLM_MODEL") || "anthropic/claude-haiku-5.5";
  const fallback = env("LLM_FALLBACK_MODEL") || "";
  try {
    return await callModel(primary, messages, timeoutMs);
  } catch (primaryErr) {
    if (!fallback || fallback === primary) throw primaryErr;
    // budget alt per plan §9.2 — outage/limit insurance, config not code
    return callModel(fallback, messages, timeoutMs).then((r) => ({ ...r, fallbackUsed: true }));
  }
}

/** The grounding contract the site's answers are held to (plan §1, §3). */
export function answerSystemPrompt(): string {
  return [
    "You are the answering surface of the 256 Foundation Public Mining Brain —",
    "an LLM-curated bitcoin-mining knowledge base. Rules, in order:",
    "",
    "1. GROUND EVERYTHING. Answer ONLY from the provided wiki context. Every",
    "   load-bearing number, date, or quote must come from that context.",
    "2. CITE. After each load-bearing claim, cite the source article like",
    "   [article title](/pages/<slug>). Articles carry their As-Of date —",
    "   repeat it when the claim is volatile (prices, firmware, hashrates).",
    "   Every citation you use MUST be from the provided context; never invent",
    "   slugs or URLs.",
    "3. KEEP DISPUTES HONEST. If context contains Disputed or Outdated status",
    "   blocks, surface the disagreement instead of picking a winner. Say",
    "   which claims are contested and why.",
    "4. ADMIT GAPS. If the context does not answer the question, say exactly",
    "   that — 'the brain doesn't know this yet' — and, if close, name the",
    "   nearest article. Never pad with general knowledge when the wiki is",
    "   silent; you may add clearly-labeled general knowledge after the",
    "   grounded answer, marked as such.",
    "5. BE DENSE. No filler. Short paragraphs; bullets over prose for specs.",
    "   The user asked a mining question, not for an essay.",
    "",
    "Context items are excerpts from wiki articles; each begins with its slug,",
    "title, As-Of date, and status markers.",
  ].join("\n");
}

export function contextBlock(hits: Array<{ slug: string; title: string; asOf: string | null; statuses: string[]; text: string }>): string {
  return hits
    .map((h, i) => {
      const meta = [
        `slug: ${h.slug}`,
        `title: ${h.title}`,
        h.asOf ? `As-Of: ${h.asOf}` : null,
        h.statuses.length ? `statuses: ${h.statuses.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      return `[${i + 1}] ${meta}\n${h.text}`;
    })
    .join("\n\n---\n\n");
}
