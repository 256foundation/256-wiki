"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Client-side search over the prebuilt Pagefind index (/pagefind/, built from
 * the knowledge pack at export time and served off the CDN). Pagefind UI is a
 * classic IIFE script → load via <script> tag and read window.PagefindUI.
 * In dev servers (no index) we say so instead of pretending.
 */
export default function PagefindSearch() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const probe = await fetch("/pagefind/pagefind-entry.json", { method: "HEAD" });
        if (!probe.ok) throw new Error("no search index at /pagefind/");

        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "/pagefind/pagefind-ui.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("pagefind-ui.js failed to load"));
          document.head.appendChild(s);
        });

        const PagefindUI = (window as unknown as { PagefindUI?: new (opts: Record<string, unknown>) => void })["PagefindUI"];
        if (!PagefindUI) throw new Error("window.PagefindUI missing");
        if (cancelled || !containerRef.current) return;

        new PagefindUI({
          element: containerRef.current,
          showSubResults: true,
          excerptLength: 24,
          translations: {
            placeholder: "Search the brain — models, pools, protocols, economics…",
            clear_search: "Clear",
          },
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(link);

    boot();
    return () => {
      cancelled = true;
      link.remove();
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} className="pagefind-holder" />
      {status === "loading" && <p className="note">loading search index…</p>}
      {status === "unavailable" && (
        <p className="note">
          The search index ships with production deploys (built from the knowledge pack at export
          time). In local dev, run <code>npm run build</code> and serve <code>out/</code> — or ask
          the API: <code>GET /api/search?q=</code>.
        </p>
      )}
    </div>
  );
}
