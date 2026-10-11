import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap simple">
      <h1>404 — this page isn't in the brain</h1>
      <p className="summary">
        The article you're after doesn't exist (yet). Try <Link href="/topics">browsing topics</Link>{" "}
        or <Link href="/ask">asking the brain</Link>.
      </p>
    </div>
  );
}
