/** Sign-in: GitHub + Google + Authentik (OIDC) — plan §3, §9.3.
 *
 * GitHub is plain OAuth2 (no id_token): code → token → /user.
 * Google + Authentik are OIDC: code → token → verify id_token via JWKS (jose).
 * Authentik's group claim can promote a session to the team tier — config, not
 * code (AUTHENTIK_TEAM_GROUP). Each provider is entirely env-gated: unset
 * credentials = button hidden (UI) and route returns 503.
 *
 * State cookie carries a CSRF nonce + the post-login redirect target.
 */

import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Hono } from "hono";
import { issueSession, sessionCookie, clearedSessionCookie, verifySession, type Session } from "./session";

type ProviderId = "github" | "google" | "authentik";

interface ProviderConfig {
  id: ProviderId;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  /** OIDC verification (id_token); absent for GitHub (fetch /user instead) */
  issuer?: string;
  jwksUrl?: string;
}

function providers(): Record<ProviderId, ProviderConfig | null> {
  const iss = (process.env.AUTHENTIK_ISSUER_URL || "").replace(/\/$/, "");
  return {
    github:
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            id: "github",
            authorizeUrl: "https://github.com/login/oauth/authorize",
            tokenUrl: "https://github.com/login/oauth/access_token",
            scope: "read:user",
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }
        : null,
    google:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            id: "google",
            authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenUrl: "https://oauth2.googleapis.com/token",
            scope: "openid email profile",
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            issuer: "https://accounts.google.com",
            jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
          }
        : null,
    authentik:
      process.env.AUTHENTIK_CLIENT_ID && process.env.AUTHENTIK_CLIENT_SECRET && iss
        ? {
            id: "authentik",
            authorizeUrl: `${iss}/authorize`,
            tokenUrl: `${iss}/token`,
            scope: "openid email profile",
            clientId: process.env.AUTHENTIK_CLIENT_ID,
            clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
            issuer: iss,
            jwksUrl: `${iss}/jwks/`,
          }
        : null,
  };
}

export function authEnabled(): boolean {
  return Object.values(providers()).some(Boolean);
}

const STATE_COOKIE = "wiki_oauth";
const STATE_TTL = 600; // seconds

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
}

interface IdClaims {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
}

export function tierForClaims(claims: IdClaims): "user" | "team" {
  const teamGroup = process.env.AUTHENTIK_TEAM_GROUP || "256f-team";
  return Array.isArray(claims.groups) && claims.groups.includes(teamGroup) ? "team" : "user";
}

export function authRoutes(): Hono {
  const auth = new Hono();

  // GET /api/auth/providers — which buttons should the UI show?
  auth.get("/api/auth/providers", (c) => {
    const p = providers();
    return c.json({
      sessionEnabled: Boolean(process.env.SESSION_SECRET),
      providers: {
        github: Boolean(p.github),
        google: Boolean(p.google),
        authentik: Boolean(p.authentik),
        nostr: true, // NIP-07: browser-extension based, no server config
        devLogin: process.env.AUTH_DEV_LOGIN === "1",
      },
    });
  });

  // GET /api/auth/start?via=github&next=/ask
  auth.get("/api/auth/start", (c) => {
    const via = c.req.query("via") as ProviderId | undefined;
    const cfg = via ? providers()[via] : undefined;
    if (!cfg) return c.json({ error: "provider-unavailable" }, 503);
    const origin = process.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
    const next = (c.req.query("next") || "/ask").startsWith("/") ? c.req.query("next") || "/ask" : "/ask";
    const state = randomUUID();
    const redirectUri = `${origin}/api/auth/callback/${cfg.id}`;
    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", cfg.scope);
    url.searchParams.set("state", state);
    if (cfg.id === "google") url.searchParams.set("response_type", "code");
    c.header("Set-Cookie", `${STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ s: state, n: next }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL}`);
    return c.redirect(url.toString());
  });

  // GET /api/auth/callback/:provider
  auth.get("/api/auth/callback/:provider", async (c) => {
    const via = c.req.param("provider") as ProviderId;
    const cfg = providers()[via];
    if (!cfg) return c.json({ error: "provider-unavailable" }, 503);
    const code = c.req.query("code");
    const state = c.req.query("state");
    const cookieState = readStateCookie(c.req.header("cookie"));
    if (!code || !state || !cookieState || cookieState.s !== state) {
      return c.json({ error: "oauth-state-mismatch" }, 400);
    }
    try {
      const origin = process.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${origin}/api/auth/callback/${cfg.id}`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) throw new Error(`token ${(await tokenRes.text()).slice(0, 120)}`);
      const tokens = (await tokenRes.json()) as TokenResponse;
      const session = await sessionFromTokens(cfg, tokens);
      const next = cookieState.n || "/ask";
      c.header("Set-Cookie", sessionCookie(issueSession(session)));
      return c.redirect(next);
    } catch (err) {
      return c.json({ error: "oauth-failed", detail: (err as Error).message?.slice(0, 160) }, 502);
    }
  });

  // POST /api/auth/nostr — NIP-98 signed event from the browser extension
  auth.post("/api/auth/nostr", async (c) => {
    const { verifyNostrAuth } = await import("./nostr");
    const body = (await c.req.json().catch(() => ({}))) as { event?: unknown };
    const result = await verifyNostrAuth(body.event, new URL(c.req.url).origin);
    if (!result.ok) return c.json({ error: result.error ?? "nostr-auth-failed" }, 401);
    const session: Session = {
      sub: `nostr:${result.pubkey}`,
      tier: "user",
      name: `nostr:${result.pubkey.slice(0, 8)}…`,
      via: "nostr",
      exp: 0,
    };
    const token = issueSession(session);
    c.header("Set-Cookie", sessionCookie(token));
    return c.json({ ok: true, tier: session.tier });
  });

  // GET /api/auth/signout
  auth.get("/api/auth/signout", (c) => {
    c.header("Set-Cookie", clearedSessionCookie());
    return c.redirect("/ask");
  });

  // GET /api/auth/dev-login — local testing of the signed-in tier without OAuth
  // apps. Only active when explicitly enabled; never reachable in prod config.
  auth.get("/api/auth/dev-login", (c) => {
    if (process.env.AUTH_DEV_LOGIN !== "1") return c.json({ error: "disabled" }, 403);
    const tier = c.req.query("tier") === "team" ? "team" : "user";
    const name = c.req.query("name") || "dev-user";
    const token = issueSession({ sub: `dev:${name}`, tier, name, via: "dev" });
    c.header("Set-Cookie", sessionCookie(token));
    return c.redirect("/ask");
  });

  return auth;
}

function readStateCookie(cookieHeader: string | undefined): { s: string; n: string } | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${STATE_COOKIE}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("="))) as { s: string; n: string };
  } catch {
    return null;
  }
}

async function sessionFromTokens(cfg: ProviderConfig, tokens: TokenResponse): Promise<Omit<Session, "exp">> {
  if (cfg.id === "github") {
    const user = await fetchJson<{ id: number; login: string }>("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "256-wiki" },
    });
    return { sub: `github:${user.id}`, tier: "user", name: user.login, via: "github" };
  }
  // OIDC: verify id_token against the provider's JWKS
  if (!cfg.issuer || !cfg.jwksUrl) throw new Error("provider misconfigured");
  const claims = (
    await jwtVerify(tokens.id_token ?? "", createRemoteJWKSet(new URL(cfg.jwksUrl)), {
      issuer: cfg.issuer,
      audience: cfg.clientId,
    })
  ).payload as unknown as IdClaims;
  const sub = claims.sub ? `${cfg.id}:${claims.sub}` : `unknown:${claims.email ?? "unknown"}`;
  const name = claims.name || claims.preferred_username || claims.email || sub;
  return { sub, tier: tierForClaims(claims), name, via: cfg.id };
}

export function currentSession(cookieHeader: string | undefined): Session | null {
  return verifySession(parseCookie(cookieHeader, "wiki_session"));
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const raw = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return raw ? raw.split("=").slice(1).join("=") : undefined;
}
