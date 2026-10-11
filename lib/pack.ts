/** Shared pack types + build-time accessors. The pack is the single
 * interface to the content repo (schema v1 — see public-mining-brain
 * scripts/build_export.py for the authoritative definition). */

export interface PackMeta {
  version: number;
  generated: string;
  contentHash: string;
  sourceCommit: string | null;
  pageCount: number;
  topicCount: number;
}

export interface PackTopic {
  id: string;
  name: string;
  description: string;
}

export interface PackPage {
  slug: string;
  topic: string;
  title: string;
  summary: string;
  updated: string | null;
  asOf: string | null;
  statuses: string[]; // lowercased: draft / disputed / outdated / resolved / stub / open bug / …
  sources: string[];
  rawLinks: string[]; // repo-root-relative: raw/<topic>/<file>.md
  backlinks: string[]; // slugs of pages linking here
  body: string; // markdown verbatim, header stripped
}

export interface KnowledgePack {
  meta: PackMeta;
  topics: PackTopic[];
  pages: PackPage[];
}

/** Epistemic statuses that get first-class UI treatment (the brand). */
export const EPISTEMIC = {
  disputed: "disputed",
  outdated: "outdated",
} as const;

export function hasStatus(page: PackPage, status: string): boolean {
  return page.statuses.some((s) => s === status || s.startsWith(`${status} `) || s.startsWith(`${status}:`));
}

export function isDisputed(page: PackPage): boolean {
  return hasStatus(page, "disputed");
}

export function isOutdated(page: PackPage): boolean {
  return hasStatus(page, "outdated");
}

/** Pages grouped by topic id, in pack order. */
export function pagesByTopic(pack: KnowledgePack): Map<string, PackPage[]> {
  const map = new Map<string, PackPage[]>();
  for (const t of pack.topics) map.set(t.id, []);
  for (const p of pack.pages) {
    if (!map.has(p.topic)) map.set(p.topic, []);
    map.get(p.topic)!.push(p);
  }
  return map;
}

/** GitHub URLs for raw sources (provenance links on every page). */
export function rawLinkUrl(rawLink: string): string {
  return `https://github.com/256foundation/public-mining-brain/blob/main/${rawLink}`;
}

/** POD256 podcast episodes a page draws on — parsed from raw capture paths
 * (…/pod256/…/2025-08-20-e081.md → episode e081, aired 2025-08-20). Rendered
 * as first-class chips: the podcast is a primary source, not a footnote. */
export function pod256Episodes(page: Pick<PackPage, "sources" | "rawLinks">): Array<{ episode: string; date: string | null }> {
  const episodes = new Map<string, string | null>();
  for (const raw of page.rawLinks) {
    const m = /pod256\/.*(\d{4}-\d{2}-\d{2})-e(\d+)\.md$/i.exec(raw);
    if (m) episodes.set(`e${m[2]}`, m[1]);
  }
  // POD256 cited as a source but no parseable episode path yet → generic chip
  if (!episodes.size && page.sources.some((s) => /pod256/i.test(s))) {
    episodes.set("podcast", null);
  }
  return [...episodes.entries()].map(([episode, date]) => ({ episode, date }));
}

export function pageEditUrl(page: Pick<PackPage, "topic" | "slug">): string {
  return `https://github.com/256foundation/public-mining-brain/blob/main/wiki/${page.topic}/${page.slug}.md`;
}
