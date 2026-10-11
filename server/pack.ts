import rawPack from "../data/pack/knowledge-pack.json";
import type { KnowledgePack } from "../lib/pack";

/**
 * The pack, bundled into the Lambda at build time (esbuild inlines the JSON —
 * scripts/build-lambda.mjs runs fetch:pack first). One cold-start import, no
 * S3 round-trip, no SDK dependency for retrieval. The pack is ~2-3MB at the
 * current wiki size; at 10× it still fits the 50MB Lambda limit comfortably.
 */
export const pack = rawPack as unknown as KnowledgePack;
