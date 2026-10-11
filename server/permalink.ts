/** /a/<id> — answer permalinks, rendered as HTML by the Lambda.
 *
 * Next's static export can't SSR, so the runtime serves these: one clean
 * shareable page per answer — question, grounded answer, citations with their
 * As-Of dates, pack provenance. OG tags make links preview properly when
 * dropped into Nostr clients, Slack, or X. Versioned by pack hash in the id.
 */

import { marked } from "marked";
import type { AnswerRow } from "./store";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip raw HTML from LLM output before markdown-rendering (prompt-injection → XSS guard).
 * Markdown syntax (links, emphasis, code) survives; only literal <tag> markup is neutralized. */
function safeMarkdown(src: string): string {
  const stripped = src.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(stripped) as string;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return iso;
  }
}

export function renderAnswerPage(row: {
  answerId: string;
  question: string;
  answer: string;
  citations: Array<{ slug: string; title: string; asOf: string | null }>;
  model: string;
  packHash: string;
  createdAt: string;
}): string {
  const title = `${row.question} — 256 wiki`;
  const description = row.answer.replace(/[#*`>[\]()\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const citationsHtml = row.citations.length
    ? `<section class="cites"><h2>Sources</h2><ol>${row.citations
        .map(
          (c) =>
            `<li><a href="/pages/${escapeHtml(c.slug)}/">${escapeHtml(c.title)}</a>${
              c.asOf ? ` <span class="asof">As-Of ${escapeHtml(c.asOf)}</span>` : ""
            }</li>`,
        )
        .join("")}</ol></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(row.question)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://wiki.256foundation.org/a/${escapeHtml(row.answerId)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/a.css">
</head>
<body>
<main>
<p class="kicker"><a href="/">256 wiki</a> · grounded answer</p>
<h1>${escapeHtml(row.question)}</h1>
<article class="answer">${safeMarkdown(row.answer)}</article>
${citationsHtml}
<footer>
<p>Answered ${escapeHtml(fmtDate(row.createdAt))} by ${escapeHtml(row.model)} from knowledge pack
<code>${escapeHtml(row.packHash.slice(0, 19))}</code>. Answers may be contested — check
<a href="/gaps/">open gaps</a>. Every number carries its <a href="/about/">As-Of date</a>.</p>
<p><a href="/ask/">Ask your own question</a> · <a href="/api/index.json">agent index</a> · <a href="/SKILL.md">agent skill</a></p>
</footer>
</main>
</body>
</html>`;
}

export function renderNotFound(answerId: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Answer not found — 256 wiki</title>
<meta name="robots" content="noindex"><link rel="stylesheet" href="/a.css"></head>
<body><main>
<p class="kicker"><a href="/">256 wiki</a></p>
<h1>Answer not found</h1>
<p>No cached answer <code>${escapeHtml(answerId)}</code> — answers expire (90 days) or the
knowledge pack was rebuilt. Ask again:</p>
<p><a href="/ask/">Ask the wiki →</a></p>
</main></body></html>`;
}
