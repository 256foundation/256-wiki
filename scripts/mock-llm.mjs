/**
 * Mock OpenAI-compatible LLM for local dev — no key, no spend.
 *
 *   node scripts/mock-llm.mjs            # :8788
 *   LLM_BASE_URL=http://localhost:8788/v1 LLM_API_KEY=dev LLM_MODEL=mock/haiku npm run dev:api
 *
 * Answers echo the question and cite the slugs found in the CONTEXT block,
 * exercising the same contract OpenRouter does (choices[0].message.content +
 * usage), so the whole ask pipeline is testable offline. CI and unit tests
 * stub fetch directly instead.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT || 8788);

createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.includes("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    try {
      const body = JSON.parse(raw);
      const userRaw = ([...(body.messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? "");
      const question = userContent(userRaw.split("\nCONTEXT")[0] ?? userRaw);
      const slugs = [...userRaw.matchAll(/slug: (\S+)/g)].map((m) => m[1]);
      const cite = slugs.slice(0, 3).map((s) => `- [${s}](/pages/${s}/)`).join("\n");
      const answer =
        question.trim().length > 0
          ? `**Mock answer** (no real LLM — set LLM_BASE_URL to OpenRouter for the real thing).\n\nYou asked: "${question}". Per the retrieved context, the grounded summary would appear here with per-claim citations and As-Of dates.\n\nSources:\n${cite || "- (no sources in context)"}`
          : "Empty question.";
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            model: body.model ?? "mock/haiku",
            choices: [{ message: { role: "assistant", content: answer } }],
            usage: { prompt_tokens: 380, completion_tokens: 120 },
          }),
        );
      }, 150);
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: String(err) }));
    }
  });
}).listen(PORT, () => console.log(`mock LLM (OpenAI-shaped) on http://localhost:${PORT}/v1/chat/completions`));

function userContent(text) {
  return text.replace(/\s+/g, " ").trim();
}
