/** Cloudflare Turnstile server-side verification (anonymous ask + suggest).
 *
 * Dev mode: when TURNSTILE_SECRET is unset, verification is skipped and the
 * request is marked `devBypass` — the UI hides the widget too (site key is the
 * NEXT_PUBLIC var). Never fabricate a pass when a secret IS configured.
 */

export interface TurnstileResult {
  ok: boolean;
  devBypass: boolean;
  errors?: string[];
}

export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET ?? "";
  if (!secret) return { ok: true, devBypass: true };
  if (!token) return { ok: false, devBypass: false, errors: ["missing-token"] };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { ok: data.success === true, devBypass: false, errors: data["error-codes"] };
  } catch {
    // verification service unreachable — fail closed (quota abuse protection)
    return { ok: false, devBypass: false, errors: ["verification-unreachable"] };
  }
}
