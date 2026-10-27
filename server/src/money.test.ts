// Run: pnpm test:server

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkedAdd, checkedMul, isMinorUnits } from "./money.ts";

test("isMinorUnits accepts safe non-negative integers only", () => {
	for (const ok of [0, 1, 100000, Number.MAX_SAFE_INTEGER]) assert.equal(isMinorUnits(ok), true, String(ok));
	for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", null, undefined]) {
		assert.equal(isMinorUnits(bad), false, String(bad));
	}
});

test("checked arithmetic returns exact integers", () => {
	assert.equal(checkedAdd(100000, 250), 100250);
	assert.equal(checkedMul(5000, 20000), 100000000);
});

test("checked arithmetic throws instead of losing precision", () => {
	assert.throws(() => checkedAdd(Number.MAX_SAFE_INTEGER, 1), RangeError);
	assert.throws(() => checkedMul(Number.MAX_SAFE_INTEGER, 2), RangeError);
	assert.throws(() => checkedMul(0.5, 3), RangeError);
	assert.throws(() => checkedAdd(NaN, 1), RangeError);
});
