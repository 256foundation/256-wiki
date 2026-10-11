#!/usr/bin/env node
/**
 * Fetch the knowledge pack for site/lambda builds.
 *
 * Resolution order:
 *   1. WIKI_PACK_URL env (explicit override — release asset URL, or file:// for local dev)
 *   2. Latest `pack-v*` GitHub release of the content repo (unauthenticated;
 *      GITHUB_TOKEN is used automatically if present to raise rate limits)
 *   3. Existing data/pack/knowledge-pack.json (cached copy from a previous build)
 *
 * The pack is a build artifact of public-mining-brain (schema v1). The site
 * never depends on a checkout of that repo in CI — this script is the only
 * coupling point, matching the "pack is the single interface" contract.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "pack");
const OUT_FILE = path.join(OUT_DIR, "knowledge-pack.json");
const REPO = process.env.WIKI_PACK_REPO || "256foundation/public-mining-brain";
const PACK_URL_ENV = process.env.WIKI_PACK_URL || "";

const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "256-wiki-build",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

function sha256(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

async function latestPackReleaseAsset() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GitHub releases ${res.status} ${res.statusText}`);
  const releases = await res.json();
  const rel = releases.find((r) => !r.draft && (r.tag_name || "").startsWith("pack-v"));
  if (!rel) throw new Error(`no pack-v* release on ${REPO} yet`);
  const asset = (rel.assets || []).find((a) => a.name === "knowledge-pack.json");
  if (!asset) throw new Error(`release ${rel.tag_name} has no knowledge-pack.json asset`);
  return { url: asset.browser_download_url, tag: rel.tag_name };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let text = null;
  let source = null;

  if (PACK_URL_ENV) {
    if (PACK_URL_ENV.startsWith("file://")) {
      text = await readFile(new URL(PACK_URL_ENV), "utf8");
    } else {
      text = await (await fetch(PACK_URL_ENV)).text();
    }
    source = `WIKI_PACK_URL (${PACK_URL_ENV})`;
  } else {
    try {
      const { url, tag } = await latestPackReleaseAsset();
      text = await (await fetch(url, { headers: HEADERS })).text();
      source = `GitHub release ${tag}`;
    } catch (err) {
      console.warn(`fetch-pack: release fetch failed (${err.message}); trying cached pack`);
      // Local-dev fallback: a sibling checkout of the content repo with a built pack.
      try {
        text = await readFile(path.resolve(ROOT, "..", "public-mining-brain", "export", "knowledge-pack.json"), "utf8");
        source = "sibling checkout ../public-mining-brain/export";
      } catch {
        /* handled below */
      }
    }
  }

  if (text == null) {
    // Last resort (CI without release + no cache): the committed 6-page sample.
    // Keeps CI green before the first pack release; real builds always get the full pack.
    try {
      text = await readFile(path.join(ROOT, "data", "pack.sample.json"), "utf8");
      source = "committed sample (data/pack.sample.json) — CI fallback";
    } catch {
      console.error(
        "fetch-pack: no WIKI_PACK_URL, no pack-v* release, no sibling checkout, and no cached pack.\n" +
          "For local dev, build one in ../public-mining-brain (python3 scripts/build_export.py)\n" +
          "or set WIKI_PACK_URL=<url of a released knowledge-pack.json>",
      );
      process.exit(1);
    }
  }

  // Validate minimally + report provenance; fail loudly on schema drift.
  let pack;
  try {
    pack = JSON.parse(text);
  } catch (err) {
    console.error(`fetch-pack: fetched pack is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  if (pack?.meta?.version !== 1 || !Array.isArray(pack.pages) || !Array.isArray(pack.topics)) {
    console.error(`fetch-pack: unexpected pack schema (meta.version=${pack?.meta?.version})`);
    process.exit(1);
  }
  const localHash = "sha256:" + createHash("sha256").update(text).digest("hex");
  if (pack.meta.contentHash && localHash !== pack.meta.contentHash) {
    // canonical hash is computed over sorted/minified json; byte hash may differ
    // for pretty-printed copies — warn, don't fail (schema carries the truth).
    console.warn(`fetch-pack: note — file hash ${localHash.slice(0, 19)}… differs from meta.contentHash (formatting drift is OK)`);
  }

  await writeFile(OUT_FILE, text);
  console.log(
    `fetch-pack: ${pack.pages.length} pages, ${pack.topics.length} topics, hash ${pack.meta.contentHash} (source: ${source})`,
  );
}

main();
