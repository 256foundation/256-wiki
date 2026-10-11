/** Signed, stateless session cookies (plan §3 identity).
 *
 * Value: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET)).
 * Payload: { sub, tier, name, via, exp } — sub is provider-stable (hashed before
 * use as a quota key), tier is anon|user|team. No server-side session store:
 * the cookie IS the session; rotation = re-issue at sign-in. HttpOnly + SameSite=Lax.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface Session {
  sub: string; // provider-stable subject (e.g. "github:1234", "npub:abcd…")
  tier: "anon" | "user" | "team";
  name: string; // display name (never used as a key)
  via: "github" | "google" | "authentik" | "nostr" | "dev";
  exp: number; // epoch seconds
}

const COOKIE_NAME = "wiki_session";
const SESSION_DAYS = 30;

function secret(): string {
  return process.env.SESSION_SECRET ?? "";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function sessionEnabled(): boolean {
  return Boolean(secret());
}

export function issueSession(partial: Omit<Session, "exp">, days = SESSION_DAYS): string {
  const payload = { ...partial, exp: Math.floor(Date.now() / 1000) + days * 86400 };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now() / 1000) return null;
    if (parsed.tier !== "user" && parsed.tier !== "team" && parsed.tier !== "anon") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function sessionCookie(value: string): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearedSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** stable, privacy-preserving quota key from a session subject */
export function subjectKey(sub: string): string {
  return createHmac("sha256", secret() || "subject-key").update(sub).digest("hex").slice(0, 16);
}
