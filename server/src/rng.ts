// Seeded PRNG for the MOCK server. Outcomes never touch Math.random: every draw is a pure function of
// (seed, label, index), so the same seed and round index always give the same result (contract §10, determinism rule).
// `label` keeps streams apart: "outcome" and "force" are keyed on the round index, "failure" on a separate counter,
// so failure injection can never shift which fixture a round draws.

import { createHmac } from "node:crypto";

/**
 * Deterministic, unbounded byte stream. Block N is HMAC-SHA256(seed, "<label>:<index>:<N>"); blocks are yielded
 * byte by byte as the caller pulls.
 */
export function* byteStream(seed: string, label: string, index: number): Generator<number, never> {
	for (let block = 0; ; block++) {
		yield* createHmac("sha256", seed).update(`${label}:${index}:${block}`).digest();
	}
}

/** Uniform integer in [0, max). Reads a uint32 and rejection-samples the top partial bucket, so there is no modulo bias. */
export function rollInt(stream: Generator<number>, max: number): number {
	if (!Number.isInteger(max) || max < 1) throw new RangeError("max must be a positive integer");
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	for (;;) {
		const [a, b, c, d] = [stream.next().value, stream.next().value, stream.next().value, stream.next().value];
		const value = ((a * 256 + b) * 256 + c) * 256 + d;
		if (value < limit) return value % max;
	}
}

/** Index drawn with chance proportional to `weights[i]` (non-negative integers with a positive sum). */
export function rollWeighted(stream: Generator<number>, weights: number[]): number {
	const total = weights.reduce((sum, w) => sum + w, 0);
	if (weights.length === 0 || !weights.every(w => Number.isInteger(w) && w >= 0) || total < 1) {
		throw new RangeError("weights must be non-negative integers with a positive sum");
	}
	let roll = rollInt(stream, total);
	return weights.findIndex(w => (roll -= w) < 0);
}

/** The n-th draw of the separate failure stream, in [0, 1). A probability, never an amount of money. */
export function failureRoll(seed: string, n: number): number {
	return rollInt(byteStream(seed, "failure", n), 1_000_000) / 1_000_000;
}
