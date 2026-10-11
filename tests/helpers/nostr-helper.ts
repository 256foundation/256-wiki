/** Test helper: build + sign a real NIP-98 event with @noble (mirrors what a
 * NIP-07 extension like Alby/nos2x does in the browser). */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface Nip98Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export async function buildSignedNostrEvent(opts: {
  url: string;
  method: string;
  skewSeconds?: number;
}): Promise<Nip98Event> {
  const priv = new Uint8Array(32);
  crypto.getRandomValues(priv);
  const pubkey = bytesToHex(schnorr.getPublicKey(priv));
  const created_at = Math.floor(Date.now() / 1000) + (opts.skewSeconds ?? 0);
  const tags = [
    ["u", opts.url],
    ["method", opts.method],
  ];
  const content = "";

  // canonical NIP-01 serialization → sha256 → BIP340 schnorr sign
  const serialized = JSON.stringify([0, pubkey, created_at, 27235, tags, content]);
  const hashBytes = sha256(new TextEncoder().encode(serialized));
  const id = bytesToHex(hashBytes);
  const sig = bytesToHex(schnorr.sign(hashBytes, priv));

  return { id, pubkey, created_at, kind: 27235, tags, content, sig };
}
