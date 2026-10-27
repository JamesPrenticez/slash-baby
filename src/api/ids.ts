/** Lowercase hex of `byteCount` random bytes, from `crypto.getRandomValues` (the built-in UUID helper is missing on plain-HTTP LAN origins). */
export function randomHex(byteCount: number): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(byteCount)), b => b.toString(16).padStart(2, "0")).join("");
}

/** A UUID v4 built from 128 random bits. One per logical action; reuse it on every retry of that action. */
export function newIdempotencyKey(): string {
	const h = randomHex(16);
	const variant = "89ab"[parseInt(h[16], 16) & 3];
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20)}`;
}
