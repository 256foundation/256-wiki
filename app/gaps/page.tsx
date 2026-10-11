import type { Metadata } from "next";
import GapsBoard from "@/components/GapsBoard";

export const metadata: Metadata = {
  title: "Gaps — what the brain doesn't know",
  description:
    "Questions people asked that the 256 Foundation Public Mining Brain couldn't ground. Curation is visible: top gaps become next week's ingest targets.",
};

export default function GapsPage() {
  return (
    <div className="wrap simple">
      <h1>Open gaps</h1>
      <p className="summary">
        Questions people asked that the brain couldn&apos;t answer. Curation is visible here:
        gaps become next week&apos;s ingest targets, highest demand first.
      </p>

      <GapsBoard />

      <h2>Know a source that would close a gap?</h2>
      <p>
        Don&apos;t wait for the board — <a href="/contribute">suggest the source now</a>. Ingestion is
        PR-based and open to everyone.
      </p>
    </div>
  );
}
