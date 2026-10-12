import type { Metadata } from "next";
import GapsBoard from "@/components/GapsBoard";

export const metadata: Metadata = {
  title: "Gaps",
  description:
    "Questions people asked that the 256 Foundation Public Mining Brain couldn't ground — highest demand first.",
};

export default function GapsPage() {
  return (
    <div className="wrap simple">
      <h1>Open gaps</h1>
      <p className="summary">
        What the brain doesn't know yet — top of the list is the next ingest target.
      </p>

      <GapsBoard />

      <p className="note">
        Know a source that closes a gap?{" "}
        <a
          href="https://github.com/256foundation/public-mining-brain/issues/new?template=suggest-a-source.md"
        >
          Suggest it
        </a>{" "}
        — don't wait for the board.
      </p>
    </div>
  );
}
