// Run: pnpm test:server
// Pure unit tests for the seeded PRNG: no HTTP, no state (contract §10 determinism rule).

import assert from "node:assert/strict";
import { test } from "node:test";

import { byteStream, failureRoll, rollInt, rollWeighted } from "./rng.ts";

const take = (gen: Generator<number>, n: number) => Array.from({ length: n }, () => gen.next().value as number);

test("byteStream is deterministic in (seed, label, index) and runs past one HMAC block", () => {
	const first = take(byteStream("seed", "outcome", 0), 80);
	assert.deepEqual(first, take(byteStream("seed", "outcome", 0), 80));
	assert.ok(first.every(b => Number.isInteger(b) && b >= 0 && b <= 255));
	assert.notDeepEqual(first.slice(0, 32), first.slice(32, 64), "block 2 differs from block 1");
});

test("byteStream diverges when seed, label or index changes", () => {
	const base = take(byteStream("seed", "outcome", 0), 32).join(",");
	assert.notEqual(base, take(byteStream("other", "outcome", 0), 32).join(","));
	assert.notEqual(base, take(byteStream("seed", "force", 0), 32).join(","));
	assert.notEqual(base, take(byteStream("seed", "outcome", 1), 32).join(","));
});

test("rollInt stays in range, is reproducible and rejects a bad max", () => {
	const rolls = Array.from({ length: 200 }, (_, i) => rollInt(byteStream("s", "outcome", i), 5));
	assert.ok(rolls.every(r => Number.isInteger(r) && r >= 0 && r < 5));
	assert.equal(rollInt(byteStream("s", "outcome", 7), 5), rollInt(byteStream("s", "outcome", 7), 5));
	for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => rollInt(byteStream("s", "outcome", 0), bad), RangeError);
});

test("rollInt covers the range without wild bias", () => {
	const counts = [0, 0, 0, 0, 0];
	for (let i = 0; i < 5000; i++) counts[rollInt(byteStream("bias", "outcome", i), 5)]++;
	assert.ok(
		counts.every(c => c > 600 && c < 1400),
		counts.join()
	);
});

test("rollWeighted follows the weights and rejects bad ones", () => {
	const counts = [0, 0, 0];
	for (let i = 0; i < 4000; i++) counts[rollWeighted(byteStream("w", "outcome", i), [1, 0, 3])]++;
	assert.equal(counts[1], 0, "a zero weight is never drawn");
	assert.ok(counts[2] > counts[0] * 2, counts.join());
	for (const bad of [[], [0, 0], [1, -1], [1.5]]) {
		assert.throws(() => rollWeighted(byteStream("w", "outcome", 0), bad), RangeError, JSON.stringify(bad));
	}
});

test("failureRoll is a pure number in [0, 1) that depends on the seed and the counter", () => {
	const rolls = Array.from({ length: 200 }, (_, n) => failureRoll("seed", n));
	assert.ok(rolls.every(r => r >= 0 && r < 1));
	assert.equal(failureRoll("seed", 3), failureRoll("seed", 3));
	assert.notEqual(failureRoll("seed", 3), failureRoll("seed", 4));
	assert.notEqual(failureRoll("seed", 3), failureRoll("other", 3));
	assert.ok(new Set(rolls).size > 150, "draws are not constant");
});

test("the failure stream is separate from the outcome stream", () => {
	// Same (seed, index): consuming failure rolls cannot change what the outcome stream yields.
	const before = take(byteStream("seed", "outcome", 0), 16);
	for (let n = 0; n < 50; n++) failureRoll("seed", n);
	assert.deepEqual(take(byteStream("seed", "outcome", 0), 16), before);
	const asInt = rollInt(byteStream("seed", "outcome", 0), 1_000_000) / 1_000_000;
	assert.notEqual(failureRoll("seed", 0), asInt, "different label, different stream");
});
