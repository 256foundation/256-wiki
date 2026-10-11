import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KnowledgePack, PackPage } from "./pack";

const PACK_PATH = path.join(process.cwd(), "data", "pack", "knowledge-pack.json");

let cached: Promise<KnowledgePack> | null = null;

/** Load the knowledge pack (build time only — static export + SSG).
 * Falls back to the vendored example under data/pack.sample when the real
 * pack hasn't been fetched yet, so `next dev` works on a fresh clone. */
export function loadPack(): Promise<KnowledgePack> {
  cached ??= (async () => {
    let text: string;
    try {
      text = await readFile(PACK_PATH, "utf8");
    } catch {
      text = await readFile(path.join(process.cwd(), "data", "pack.sample.json"), "utf8");
    }
    return JSON.parse(text) as KnowledgePack;
  })();
  return cached;
}

export async function getPage(slug: string): Promise<PackPage | undefined> {
  const pack = await loadPack();
  return pack.pages.find((p) => p.slug === slug);
}

export async function getTopic(id: string) {
  const pack = await loadPack();
  return pack.topics.find((t) => t.id === id);
}
