/** Live data strip — pool Prometheus + mempool.space, cached in-memory ≥60s.
 * Per the playbook: dash.256f.org is NEVER scraped; live numbers come from the
 * pool Prometheus API and mempool.space only. Failures degrade to nulls, never
 * to fabricated values. */

const CACHE_TTL_MS = 60_000;

export interface LiveStats {
  updated: string;
  cacheAgeSeconds: number | null;
  pool: {
    hashrate: string | null; // formatted, e.g. "12.4 PH/s"
    hashrateHps: number | null;
    activeWorkers: number | null;
    source: string;
  };
  network: {
    difficulty: string | null;
    hashrate: string | null;
    blockHeight: number | null;
    source: string;
  };
}

let cache: { at: number; value: LiveStats } | null = null;

const POOL_PROM_URL = process.env.POOL_PROM_URL || "https://pool.256foundation.org";
const MEMPOOL_API_URL = process.env.MEMPOOL_API_URL || "https://mempool.space/api";
const FETCH_TIMEOUT_MS = 4000;

async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function poolQuery(query: string): Promise<number | null> {
  try {
    const url = `${POOL_PROM_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
    const body = (await fetchJson(url)) as {
      status?: string;
      data?: { result?: Array<{ value: [number, string] }> };
    };
    if (body?.status !== "success" || !body.data?.result?.[0]) return null;
    const n = Number(body.data.result[0].value[1]);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function formatHashrate(hps: number): string {
  if (!Number.isFinite(hps) || hps <= 0) return "0 H/s";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let i = 0;
  let v = hps;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** Pool telemetry via the playbook's PromQL contract (rate = H/s). */
async function getPool() {
  const [total, active] = await Promise.all([
    poolQuery("sum(rate(worker_shares_valid_total[5m]))"),
    poolQuery("count(sum by (btcaddress) (rate(worker_shares_valid_total[5m])))"),
  ]);
  return {
    hashrate: total != null ? formatHashrate(total) : null,
    hashrateHps: total,
    activeWorkers: active,
    source: "pool.256foundation.org Prometheus",
  };
}

async function getNetwork() {
  const result = {
    difficulty: null as string | null,
    hashrate: null as string | null,
    blockHeight: null as number | null,
    source: "mempool.space",
  };
  try {
    const height = await fetchJson(`${MEMPOOL_API_URL}/v1/blocks/tip/height`, 3000);
    const n = Number(height);
    result.blockHeight = Number.isFinite(n) ? n : null;
  } catch {
    /* degrade — mempool may be slow; the strip shows "—" */
  }
  try {
    const stats = (await fetchJson(`${MEMPOOL_API_URL}/v1/mining/hashrate/3d`, 4000)) as {
      currentHashrate?: number;
      currentDifficulty?: number;
      hashrates?: Array<{ timestamp: number; avgHashrate: number }>;
      difficulty?: Array<{ timestamp: number; difficulty: number }>;
    };
    const hr = Number(stats.currentHashrate) || stats.hashrates?.at(-1)?.avgHashrate;
    if (hr && Number.isFinite(hr)) result.hashrate = formatHashrate(hr);
    const diff = Number(stats.currentDifficulty) || stats.difficulty?.at(-1)?.difficulty;
    if (diff && Number.isFinite(diff)) result.difficulty = formatDifficulty(diff);
  } catch {
    /* degrade */
  }
  return result;
}

function formatDifficulty(d: number): string {
  if (!Number.isFinite(d)) return "—";
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)} T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G`;
  return d.toExponential(2);
}

export async function getLiveStats(): Promise<LiveStats> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.value, cacheAgeSeconds: Math.round((Date.now() - cache.at) / 1000) };
  }
  const [pool, network] = await Promise.all([getPool(), getNetwork()]);
  const value: LiveStats = { updated: new Date().toISOString(), cacheAgeSeconds: 0, pool, network };
  cache = { at: Date.now(), value };
  return value;
}
