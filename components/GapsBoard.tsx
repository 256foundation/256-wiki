"use client";

/** The open gaps board — live view of what the brain doesn't know (plan §4).
 *
 * Data: GET /api/gaps.json (Lambda, clustered from the ask pipeline's query
 * log, 60s CDN cache). States: loading → board / empty (honest: "no gaps yet").
 * Each gap: demand count, last asked, suggest-a-source CTA.
 */

import { useEffect, useState } from "react";

interface GapCluster {
  qhash: string;
  question: string;
  count: number;
  firstAskedAt: string;
  lastAskedAt: string;
}

interface GapsBody {
  meta: { updated: string; note: string };
  stats: { gapAsks: number; distinctGaps: number };
  gaps: GapCluster[];
}

function fmtDay(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export default function GapsBoard() {
  const [body, setBody] = useState<GapsBody | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/gaps.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setBody)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="askmsg warn">
        <strong>The board didn&apos;t load.</strong>
        <p>
          The gaps API didn&apos;t answer. It lives on the runtime Lambda — check{" "}
          <a href="/api/health">/api/health</a> or try again shortly.
        </p>
      </div>
    );
  }

  if (!body) {
    return (
      <div className="gapsboard loading">
        <p className="note">loading the board…</p>
      </div>
    );
  }

  if (!body.gaps.length) {
    return (
      <div className="gapsboard empty">
        <p>
          <strong>No gaps yet.</strong> The board lights up as people ask the brain things it
          can&apos;t ground — every unanswerable question lands here automatically.
        </p>
        <p className="note">
          Know something mining-related the wiki should cover?{" "}
          <a href="/contribute">Suggest the source</a> before anyone even has to ask.
        </p>
      </div>
    );
  }

  return (
    <div className="gapsboard">
      <p className="note">
        {body.stats.distinctGaps} distinct gap{body.stats.distinctGaps === 1 ? "" : "s"} from{" "}
        {body.stats.gapAsks} ungrounded ask{body.stats.gapAsks === 1 ? "" : "s"} · updated{" "}
        {fmtDay(body.meta.updated)} · sorted by demand
      </p>
      <ol className="gaplist">
        {body.gaps.map((g) => (
          <li key={g.qhash} className="gaprow">
            <span className="gapcount" title="people asked this">
              {g.count}×
            </span>
            <span className="gapmain">
              <span className="gapq">{g.question}</span>
              <span className="gapmeta note">
                the brain doesn&apos;t know yet · last asked {fmtDay(g.lastAskedAt)}
              </span>
            </span>
            <a className="backlink-chip" href="/contribute">
              suggest a source
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
