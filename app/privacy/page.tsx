import type { Metadata } from "next";

export const metadata = {
  title: "Privacy",
  description:
    "What the 256 Foundation Public Mining Brain stores when you ask, sign in, or browse: identity hashes only, no tracking cookies, no analytics.",
};

const rows: Array<[string, string]> = [
  [
    "Anonymous asks",
    "Daily quota accounting uses a one-way SHA-256 hash of your IP address, truncated to 16 hex characters. The IP itself is never stored, and the hash can't be reversed without the source. It resets with the daily quota.",
  ],
  [
    "Sign-in sessions",
    "If you sign in (GitHub, Google, your Authentik instance, or Nostr), you get one cookie: an HMAC-signed session token, HttpOnly, SameSite=Lax, 30 days. It carries your display name and tier — nothing else. There are no tracking cookies of any kind.",
  ],
  [
    "Identity storage",
    "We never store your provider account ID or email. Sessions reference a subject key — an HMAC of the provider's subject ID — plus the display name you'd see anyway. The foundation cannot reconstruct your account from what's stored.",
  ],
  [
    "Question log",
    "Every question is logged with its retrieval metadata (matched pages, scores, model used, cached-or-not) so the public gaps board can show what the brain doesn't know. Log entries expire after 180 days.",
  ],
  [
    "Answers & permalinks",
    "Generated answers are cached for up to 90 days and are public by design: every answer has a permanent /a/ link anyone can cite. Answers cite their sources with As-Of dates.",
  ],
  [
    "Captcha (Turnstile)",
    "When anonymous captcha is enabled, asking runs Cloudflare's Turnstile check — a privacy-friendly challenge handled by Cloudflare. Signed-in users skip it entirely.",
  ],
  [
    "Agent traffic (MCP / API)",
    "Search, page, and pack retrieval is free, unmetered, and anonymous — no identity, no quota keys, no logging tied to you.",
  ],
  [
    "What we don't do",
    "No analytics, no ads, no third-party trackers, no fingerprinting, no selling data, no cross-site anything. The site is static HTML plus two small APIs; you can read exactly what runs in the open repos.",
  ],
];

export default function PrivacyPage() {
  return (
    <div className="wrap simple">
      <h1>Privacy</h1>
      <p className="summary">
        The Public Mining Brain is built to know things, not to know you. This page is the
        complete list of what touches you when you use the site — there is no other data
        collection to disclose.
      </p>

      <dl className="privacylist">
        {rows.map(([term, def]) => (
          <div key={term} className="privacyrow">
            <dt>{term}</dt>
            <dd>{def}</dd>
          </div>
        ))}
      </dl>

      <h2>Where the code lives</h2>
      <p>
        Everything above is verifiable in the open:{" "}
        <a href="https://github.com/256foundation/256-wiki">site code</a> (sessions, quota
        hashing, log TTLs) and{" "}
        <a href="https://github.com/256foundation/public-mining-brain">content pipeline</a>. The
        infrastructure-as-code that defines what's stored is in the same repos.
      </p>
      <p className="note">
        Questions about any of this? Open an issue on the site repo or{" "}
        <a href="https://256foundation.org">contact the foundation</a>.
      </p>
    </div>
  );
}
