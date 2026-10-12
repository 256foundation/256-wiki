"use client";

/** Library search — click-to-search over the runtime /api/search (BM25).
 * Telegraphic results: title · topic · As-Of · snippet. */

import { useState } from "react";

interface Hit {
  slug: string;
  topic: string;
  title: string;
  snippet: string;
  asOf: string | null;
}

export default function LibrarySearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  // retrieval snippets are raw markdown — flatten for display
  const clean = (s: string) =>
    s
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#*`_>]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`);
      const body = (await r.json()) as { results?: Hit[] };
      setHits(body.results ?? []);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="libsearch">
      <form className="landbox" onSubmit={run}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the library…"
          aria-label="Search the library"
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "…" : "Search →"}
        </button>
      </form>

      {hits ? (
        hits.length ? (
          <ul className="topiclist">
            {hits.map((h) => (
              <li key={h.slug}>
                <a className="topicrow-title" href={`/pages/${h.slug}/`}>
                  {h.title}
                </a>
                <div className="topicrow-summary">{clean(h.snippet)}</div>
                <div className="topicrow-meta">
                  <span>{h.topic}</span>
                  {h.asOf ? <span>As-Of {h.asOf}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">No hits — try fewer words, or ask the brain instead.</p>
        )
      ) : null}
    </div>
  );
}
