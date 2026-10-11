/** Gap clustering for the public unanswered-questions board (plan §7 Phase 4).
 *
 * A "gap" is a logged question the pipeline couldn't ground (model "none").
 * Identical normalized questions share a qhash, so clustering = group by qhash,
 * keep the newest wording, count askers. Sorted by demand (count) then recency —
 * the top of this list is next week's ingest target.
 */

import type { QueryLogRow } from "./store";

export interface GapCluster {
  qhash: string;
  question: string;
  count: number;
  firstAskedAt: string;
  lastAskedAt: string;
}

export function isGapRow(row: QueryLogRow): boolean {
  return row.model === "none" && !row.cached;
}

export function clusterGaps(rows: QueryLogRow[]): GapCluster[] {
  const byQhash = new Map<string, GapCluster>();
  for (const row of rows) {
    if (!isGapRow(row)) continue;
    const existing = byQhash.get(row.qhash);
    if (!existing) {
      byQhash.set(row.qhash, {
        qhash: row.qhash,
        question: row.question,
        count: 1,
        firstAskedAt: row.createdAt,
        lastAskedAt: row.createdAt,
      });
      continue;
    }
    existing.count += 1;
    // keep the newest wording — people phrase it better over time
    if (row.createdAt > existing.lastAskedAt) {
      existing.lastAskedAt = row.createdAt;
      existing.question = row.question;
    }
    if (row.createdAt < existing.firstAskedAt) existing.firstAskedAt = row.createdAt;
  }
  return [...byQhash.values()].sort(
    (a, b) => b.count - a.count || b.lastAskedAt.localeCompare(a.lastAskedAt),
  );
}
