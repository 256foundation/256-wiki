import { marked } from "marked";

/** Markdown → segments: ordinary markdown vs epistemic status blocks.
 *
 * The wiki encodes honesty in blockquotes:
 *   > **Status: Disputed** (price)
 *   > {competing claims…}
 *   > **Status: Outdated** (2026-10-01)
 *   > {what changed…}
 *
 * These are the brand — they render as first-class amber callouts, never as
 * plain blockquotes. This module pulls them out of the body before markdown
 * rendering so the UI controls their presentation.
 *
 * Also handles wiki-relative link resolution: article bodies link
 * topic-locally (`other-article.md`, `../topic/other.md`); we rewrite them to
 * site URLs (/pages/<slug>) at render time.
 */

export type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "status"; status: string; qualifier: string; body: string };

const STATUS_BLOCK_RE = /^>\s*\*\*Status:\s*([^*]+?)\*\*\s*(.*)$/;

/** Parse a body into segments. Status blocks start at a `> **Status: X**`
 * line and continue while consecutive lines are blockquote lines (`> …`). */
export function splitStatusBlocks(body: string): Segment[] {
  const segments: Segment[] = [];
  const lines = body.split("\n");
  let markdown: string[] = [];
  let i = 0;

  const flushMarkdown = () => {
    if (markdown.length) {
      segments.push({ kind: "markdown", text: markdown.join("\n") });
      markdown = [];
    }
  };

  while (i < lines.length) {
    const m = STATUS_RE.exec(lines[i]);
    if (!m) {
      markdown.push(lines[i]);
      i += 1;
      continue;
    }
    // gather the full status block (the `>` lines that follow)
    const blockLines: string[] = [];
    let j = i;
    while (j < lines.length && (lines[j].startsWith(">") || (j > i && lines[j].trim() === "" && j + 1 < lines.length && lines[j + 1].startsWith(">")))) {
      blockLines.push(lines[j]);
      j += 1;
    }
    // blank-line lookahead must not swallow the paragraph after the block
    while (blockLines.length && blockLines[blockLines.length - 1].trim() === "") blockLines.pop();
    flushMarkdown();
    const status = m[1].trim();
    const qualifier = (m[2] || "").replace(/^\s*[—-]\s*/, "").replace(/^\((.*)\)\s*$/, "$1").trim();
    const bodyText = blockLines
      .slice(1) // drop the `**Status:**` line itself
      .map((l) => l.replace(/^>\s?/, ""))
      .join("\n")
      .trim();
    segments.push({ kind: "status", status, qualifier, body: bodyText });
    i = j;
  }
  flushMarkdown();
  return segments;
}

const STATUS_RE = /^>\s*\*\*Status:\s*([^*]+?)\*\*\s*(.*)$/;

/** The wiki writes spec values verbatim: `20~50 ℃`, `339*173*207 mm`. GFM
 * would eat those as strikethrough/emphasis, mangling numbers. Escape lone
 * tildes and digit-asterisk-digits (keep real `~~strike~~` working). */
export function protectSpecs(markdown: string): string {
  return markdown
    .replace(/~~/g, "\u0000STRK\u0000")
    .replace(/~/g, "\\~")
    .replace(/\u0000STRK\u0000/g, "~~")
    .replace(/(\d)\*(\d)/g, "$1\\*$2");
}

/** Full render pipeline for wiki bodies: spec protection + link rewriting. */
export function wikiMarkdown(markdown: string, topic: string): string {
  return marked.parse(resolveWikiLinks(protectSpecs(markdown), topic)) as string;
}

/** Rewrite wiki-relative markdown links to site URLs. */
export function resolveWikiLinks(markdown: string, topic: string): string {
  return markdown.replace(/\[([^\]]*)\]\(([^)\s]+\.md)(#[^)]*)?\)/g, (full, label: string, href: string, hash = "") => {
    const target = slugFromHref(href, topic);
    if (!target) return full;
    return `[${label}](/pages/${target}${hash})`;
  });
}

function slugFromHref(href: string, currentTopic: string): string | null {
  const clean = href.split("#")[0].trim();
  if (!clean || !clean.endsWith(".md")) return null;
  if (clean.startsWith("../../raw/") || clean.startsWith("../raw/")) return null; // raw provenance links handled separately
  const parts = clean.split("/").filter(Boolean);
  const file = parts[parts.length - 1];
  if (!file || file === "index.md" || file === "log.md") return null;
  return file.replace(/\.md$/, "");
}

/** Raw links pointing into raw/ get GitHub hrefs; wiki links get site hrefs. */
export function rawHref(href: string): string {
  // links like ../../raw/<topic>/<file>.md (file-relative from wiki/<topic>/)
  const i = href.indexOf("raw/");
  if (i === -1) return href;
  return `https://github.com/256foundation/public-mining-brain/blob/main/${href.slice(i)}`;
}

export function linkHref(href: string, currentTopic: string): string {
  if (/^https?:/.test(href)) return href;
  if (/(^|\.)\.\.?\/.*(\/|^)raw\//.test(href) || href.includes("/raw/")) return rawHref(href);
  const target = slugFromHref(href, currentTopic);
  return target ? `/pages/${target}` : href;
}
