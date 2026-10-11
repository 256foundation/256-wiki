"use client";

import { useEffect, useState } from "react";

type Live = {
  updated: string;
  cacheAgeSeconds: number | null;
  pool: { hashrate?: string; activeWorkers?: number | null; source: string };
  network: { difficulty?: string; hashrate?: string; blockHeight?: number | null; source: string };
};

const FALLBACK: Live = {
  updated: "",
  cacheAgeSeconds: null,
  pool: { source: "pool.256foundation.org" },
  network: { source: "mempool.space" },
};

export default function LiveStrip() {
  const [live, setLive] = useState<Live | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/live.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Live) => setLive(j))
      .catch(() => setFailed(true));
  }, []);

  const data = live ?? FALLBACK;

  return (
    <section className="livestrip" aria-label="Live mining data">
      <Cell
        label="Pool hashrate"
        value={live?.pool.hashrate ?? (failed || !live ? "—" : "")}
        source="256F pool Prometheus"
        dim={!live}
      />
      <Cell
        label="Active workers"
        value={live?.pool.activeWorkers != null ? String(live.pool.activeWorkers) : "—"}
        source="256F pool Prometheus"
        dim={!live}
      />
      <Cell
        label="Network hashrate"
        value={live?.network.hashrate ?? "—"}
        source="mempool.space"
        dim={!live}
      />
      <Cell
        label="Difficulty"
        value={live?.network.difficulty ?? "—"}
        source="mempool.space"
        dim={!live}
      />
      {failed && <p className="note">live data unavailable right now — the strip refreshes from the pool and mempool APIs</p>}
    </section>
  );
}

function Cell({ label, value, source, dim }: { label: string; value: string; source: string; dim?: boolean }) {
  return (
    <div className="cell">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="src">{source}</div>
      {dim && <div className="src">loading…</div>}
    </div>
  );
}
