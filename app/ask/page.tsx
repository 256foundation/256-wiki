import type { Metadata } from "next";
import AskConsole from "@/components/AskConsole";

export const metadata: Metadata = {
  title: "Ask the brain",
  description:
    "Grounded answers from the 256 Foundation Public Mining Brain — every answer cites its wiki sources with As-Of dates and gets a permanent permalink.",
};

const ANON_QUOTA = Number(process.env.NEXT_PUBLIC_ANON_QUOTA || 5);

export default function AskPage() {
  return (
    <div className="wrap simple">
      <h1>Ask the brain</h1>
      <p className="summary">
        Every answer cites its wiki sources with As-Of dates and gets a permanent permalink.
      </p>

      <AskConsole anonQuota={ANON_QUOTA} />

      <p className="note">
        Running an agent? <a href="/agents">Point it at the brain</a> — retrieval is free and
        unmetered.
      </p>
    </div>
  );
}
