/** Sign in with Nostr — NIP-98 HTTP auth events (plan §9.3).
 *
 * The browser (NIP-07 extension: Alby, nos2x,…) signs a kind:27235 event over
 * the canonical NIP-01 serialization; we verify the schnorr signature over
 * sha256(serialization), the recency window, and the u/method tags. No
 * personal data crosses the wire beyond the public key.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const KIND = 27235;
const MAX_SKEW_SECONDS = 300; // ±5 min

interface NostrEvent {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

/** canonical NIP-01 serialization the event id is computed over */
function serialize(e: NostrEvent): string {
  return JSON.stringify([
    0,
    e.pubkey,
    e.created_at,
    e.kind,
    e.tags,
    e.content,
  ]);
}

export async function verifyNostrAuth(
  input: unknown,
  expectedOrigin: string,
  expectedMethod = "POST",
): Promise<{ ok: true; pubkey: string } | { ok: false; error: string }> {
  const ev = input as NostrEvent;
  if (!ev || typeof ev !== "object") return { ok: false, error: "missing-event" };
  if (ev.kind !== KIND) return { ok: false, error: "wrong-kind" };
  if (!ev.pubkey || !ev.sig || !ev.id) return { ok: false, error: "missing-fields" };
  if (typeof ev.created_at !== "number" || Math.abs(Date.now() / 1000 - ev.created_at) > MAX_SKEW_SECONDS) {
    return { ok: false, error: "stale-event" };
  }

  // id must equal sha256 of the canonical serialization
  const hash = sha256(new TextEncoder().encode(serialize(ev)));
  if (ev.id !== bytesToHex(hash)) return { ok: false, error: "id-mismatch" };

  // tags: [["u", url], ["method", POST]]
  const u = ev.tags?.find((t) => t[0] === "u")?.[1] ?? "";
  const method = ev.tags?.find((t) => t[0] === "method")?.[1] ?? "";
  const originOf = (raw: string): string => {
    try {
      return new URL(raw).origin;
    } catch {
      return raw;
    }
  };
  if (!u || !originOf(u).startsWith(expectedOrigin)) return { ok: false, error: "u-mismatch" };
  if ((method || "").toUpperCase() !== expectedMethod) return { ok: false, error: "method-mismatch" };

  // schnorr (BIP340) over the 32-byte id
  let valid = false;
  try {
    valid = schnorr.verify(hexToBytes(ev.sig), hexToBytes(ev.id), hexToBytes(ev.pubkey));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: "bad-signature" };
  return { ok: true, pubkey: ev.pubkey };
}
