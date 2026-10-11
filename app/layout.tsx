import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://wiki.256foundation.org"),
  title: {
    default: "256 Foundation — Public Mining Brain",
    template: "%s — 256 Foundation wiki",
  },
  description:
    "Grounded, As-Of-stamped, Disputed-block-honest bitcoin-mining knowledge — maintained by agents under human review, open to humans and AI agents alike.",
  openGraph: {
    siteName: "256 Foundation — Public Mining Brain",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  const links = [
    ["/topics", "Topics"],
    ["/search", "Search"],
    ["/ask", "Ask"],
    ["/gaps", "Gaps"],
    ["/contribute", "Contribute"],
    ["/about", "About"],
  ] as const;
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/" className="brand">
          <span className="brand-256">256</span> Foundation · Mining Brain
        </Link>
        <nav>
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <strong>256 Foundation</strong> is a 501(c)(3) public charity.
            <br />
            Content:{" "}
            <a href="https://github.com/256foundation/public-mining-brain">public-mining-brain</a> ·
            Site code: <a href="https://github.com/256foundation/256-wiki">256-wiki</a>
          </div>
          <div>
            <a href="/llms.txt">llms.txt</a> · <a href="/SKILL.md">SKILL.md</a> ·{" "}
            <a href="/api/feed.xml">RSS</a> · <a href="https://256foundation.org">256foundation.org</a>
          </div>
        </div>
        <p className="note" style={{ marginTop: 18 }}>
          Answers are As-Of stamped and cite their sources. Where sources disagree, this wiki shows
          the disagreement instead of picking a winner for you.
        </p>
      </div>
    </footer>
  );
}
