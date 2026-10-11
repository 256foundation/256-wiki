"use client";

/**
 * The ask console — the human face of the pipeline (plan §3).
 *
 * Single-shot by default; after an answer, follow-ups thread onto it (each
 * message costs one quota unit — the foundation pays those tokens). Errors are
 * honest and always point at the unlimited path: connect your own agent.
 * Turnstile renders only when the site key is present (dev skips it).
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface Citation {
  slug: string;
  title: string;
  asOf: string | null;
  url: string;
}

interface AskOk {
  answerId: string;
  permalink: string;
  question: string;
  answer: string;
  answerHtml: string;
  citations: Citation[];
  cached: boolean;
  quotaRemaining: number | null;
  model: string;
  breakerTripped: boolean;
  packHash: string;
}

type Turn =
  | { kind: "ok"; data: AskOk }
  | { kind: "gap"; data: AskOk }
  | { kind: "quota"; message: string }
  | { kind: "breaker"; message: string }
  | { kind: "error"; message: string };

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function AskConsole({ anonQuota }: { anonQuota: number }) {
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

  // Turnstile (production): load the script + render the invisible-ish widget
  useEffect(() => {
    if (!SITE_KEY) return;
    const el = document.getElementById("turnstile-box");
    if (!el || (window as unknown as { turnstile?: unknown }).turnstile) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const ts = (window as unknown as { turnstile: { render: (el: HTMLElement, opts: object) => string } }).turnstile;
      ts.render(el, {
        sitekey: SITE_KEY,
        callback: (token: string) => setTsToken(token),
        "expired-callback": () => setTsToken(null),
      });
    };
    document.head.appendChild(script);
  }, []);

  // scrub markdown-rendered links (server strips raw HTML already; belt+suspenders)
  const scrubLinks = useCallback((root: HTMLElement | null) => {
    root?.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      const ok = /^(https?:|mailto:|\/|#)/i.test(href);
      if (!ok) a.removeAttribute("href");
      if (href.startsWith("http") && !href.includes("wiki.256foundation.org")) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    const prevAnswer = historyRef.current.length ? historyRef.current[historyRef.current.length - 1].content : null;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: historyRef.current.length ? historyRef.current : undefined,
          turnstileToken: tsToken ?? undefined,
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        const data = body as unknown as AskOk;
        historyRef.current = (
          [
            ...historyRef.current,
            { role: "user" as const, content: q },
            { role: "assistant" as const, content: data.answer },
          ] as Array<{ role: "user" | "assistant"; content: string }>
        ).slice(-6);
        if (typeof data.quotaRemaining === "number") setQuotaLeft(data.quotaRemaining);
        setTurns((t) => [...t, { kind: data.citations.length || data.model !== "none" ? "ok" : "gap", data }]);
        if (inputRef.current) inputRef.current.value = "";
      } else if (body.error === "quota-exceeded") {
        setTurns((t) => [...t, { kind: "quota", message: String(body.message ?? "Daily limit reached.") }]);
      } else if (body.error === "breaker-tripped") {
        setTurns((t) => [...t, { kind: "breaker", message: String(body.message ?? "Token budget spent.") }]);
      } else {
        setTurns((t) => [...t, { kind: "error", message: String(body.message ?? body.error ?? `HTTP ${res.status}`) }]);
      }
    } catch {
      setTurns((t) => [...t, { kind: "error", message: "Network error — the API didn't answer." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="askconsole">
      <div className="askrow">
        {/* uncontrolled on purpose: reads the DOM value on submit, so keyboard,
            paste, prefill and agent-drivers all work the same way */}
        <textarea
          id="ask-input"
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(inputRef.current?.value ?? "");
          }}
          placeholder="e.g. What's the difference between FPPS and PPLNS — and who keeps the fees?"
          rows={2}
          maxLength={2000}
          aria-label="Your mining question"
        />
        <button type="button" onClick={() => ask(inputRef.current?.value ?? "")} disabled={busy}>
          {busy ? "Thinking…" : turns.length ? "Follow up" : "Ask"}
        </button>
      </div>

      <div className="askmeta">
        <span className="note">
          {SITE_KEY
            ? tsToken
              ? "✓ verified human"
              : "complete the check below to ask"
            : null}
          {quotaLeft !== null ? ` · ${quotaLeft} free answer${quotaLeft === 1 ? "" : "s"} left today` : ` · ${anonQuota} free answers/day`}
          {" · "}
          <em>cache hits are always free</em>
        </span>
        <span className="note hint">⌘↵ to ask</span>
      </div>

      {SITE_KEY ? <div id="turnstile-box" className="turnstile" /> : null}

      {turns.map((turn, i) => (
        <TurnView key={i} turn={turn} scrubLinks={scrubLinks} />
      ))}
    </div>
  );
}

function TurnView({ turn, scrubLinks }: { turn: Turn; scrubLinks: (el: HTMLElement | null) => void }) {
  if (turn.kind === "quota" || turn.kind === "breaker" || turn.kind === "error") {
    return (
      <div className={`askmsg ${turn.kind === "breaker" ? "breaker" : "warn"}`}>
        <strong>{turn.kind === "breaker" ? "Foundation budget spent for today." : turn.kind === "quota" ? "Daily free answers used up." : "Something went wrong."}</strong>
        <p>{turn.message}</p>
        <p className="note">
          The unlimited path: <a href="#connect-your-agent">connect your own agent</a> — search, pages, and MCP
          retrieval are free and unmetered.
        </p>
      </div>
    );
  }

  const d = turn.data;
  const gap = turn.kind === "gap";
  return (
    <div className={`askanswer${gap ? " gap" : ""}`}>
      <div className="anshead">
        {gap ? <span className="badge disputed">gap logged</span> : null}
        {d.cached ? <span className="badge asof">cache hit — free</span> : null}
        <span className="badge">{d.model === "none" ? "no LLM needed" : d.model.split("/").pop()}</span>
        {d.packHash ? (
          <span className="badge" title={d.packHash}>
            pack {d.packHash.slice(7, 15)}
          </span>
        ) : null}
      </div>
      <div
        className="article answerview"
        ref={(el) => scrubLinks(el)}
        dangerouslySetInnerHTML={{ __html: d.answerHtml }}
      />
      {d.citations.length ? (
        <div className="anscites">
          <span className="anscites-label">Sources</span>
          {d.citations.map((c) => (
            <a key={c.slug} className="backlink-chip" href={`/pages/${c.slug}/`}>
              {c.title}
              {c.asOf ? <span className="cite-asof"> · As-Of {c.asOf}</span> : null}
            </a>
          ))}
        </div>
      ) : null}
      <div className="ansfoot">
        <a className="permalink" href={d.permalink}>
          ¶ permalink
        </a>
        <CopyButton text={`https://wiki.256foundation.org${d.permalink}`} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copybtn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "copied ✓" : "copy link"}
    </button>
  );
}
