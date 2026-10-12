import type { Metadata } from "next";
import Link from "next/link";
import { Barlow_Condensed, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://wiki.256foundation.org"),
  title: {
    default: "256 Foundation — Public Mining Brain",
    template: "%s — 256 Foundation wiki",
  },
  description:
    "The bitcoin-mining brain: grounded, As-Of-stamped, dispute-honest. Ask it, browse it, or point your agent at it.",
  openGraph: {
    siteName: "256 Foundation — Public Mining Brain",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/" className="brand" aria-label="256 Foundation — Mining Brain, home">
          <picture className="brand-logo">
            {/* dark scheme → white artwork; light scheme → dark artwork */}
            <source media="(prefers-color-scheme: dark)" srcSet="/logos/256-logo-secondary-light.png" />
            <img
              src="/logos/256-logo-secondary-dark.png"
              alt="256 Foundation"
              width={100}
              height={32}
              style={{ height: 32, width: "auto", display: "block" }}
            />
          </picture>
          <span className="brand-main">Mining Brain</span>
        </Link>
        <nav>
          <a href="/ask">Ask</a>
          <a href="/library">Library</a>
          <a href="/about">About</a>
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
          <span>
            <a href="/gaps">Gaps</a> · <a href="/contribute">Contribute</a> ·{" "}
            <a href="/agents">Agents</a> · <a href="/privacy">Privacy</a>
          </span>
          <span>
            <a href="/llms.txt">llms.txt</a> · <a href="/SKILL.md">SKILL.md</a> ·{" "}
            <a href="/api/feed.xml">RSS</a> ·{" "}
            <a href="https://256foundation.org">256foundation.org</a>
          </span>
          <span>
            256 Foundation is a 501(c)(3) public charity ·{" "}
            <a href="https://github.com/256foundation/public-mining-brain">content</a> ·{" "}
            <a href="https://github.com/256foundation/256-wiki">code</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
