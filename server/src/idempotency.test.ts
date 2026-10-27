// Run: pnpm test:server
// The per-player key store (contract §9).

import assert from "node:assert/strict";
import { test } from "node:test";

import { forgetKeys, remember, replayOf } from "./idempotency.ts";
import type { PlayMessage, PlayResponse } from "../../src/types/api.ts";

const KEY = "0123456789abcdef0123";
const start = (wagerMinorUnits: number): PlayMessage => ({ start: { wagerMinorUnits } });
const response = (balanceMinorUnits: number): PlayResponse => ({
	roundId: "r1",
	message: { round: { roundId: "r1" } as PlayResponse["message"]["round"], balanceMinorUnits }
});

test("an unseen key has no stored response", () => {
	assert.equal(replayOf("idem-new", KEY, start(100)), undefined);
});

test("the same key and message replays the stored response with replayed: true", () => {
	remember("idem-a", KEY, start(100), response(99_900));
	const replay = replayOf("idem-a", KEY, start(100))!;
	assert.equal(replay.message.replayed, true);
	assert.equal(replay.message.balanceMinorUnits, 99_900);
	assert.equal(replay.roundId, "r1");
});

test("the stored response is a snapshot, not a live object", () => {
	const live = response(1);
	remember("idem-snap", KEY, start(100), live);
	live.message.balanceMinorUnits = 2;
	assert.equal(replayOf("idem-snap", KEY, start(100))!.message.balanceMinorUnits, 1);
	const first = replayOf("idem-snap", KEY, start(100))!;
	first.message.balanceMinorUnits = 3;
	assert.equal(replayOf("idem-snap", KEY, start(100))!.message.balanceMinorUnits, 1);
});

test("the same key with a different message is 409 idempotency_key_reused", () => {
	remember("idem-b", KEY, start(100), response(1));
	assert.throws(
		() => replayOf("idem-b", KEY, start(200)),
		{ status: 409, code: "idempotency_key_reused" },
		"different wager"
	);
	assert.throws(
		() => replayOf("idem-b", KEY, { settle: { roundId: "r1" } }),
		{ status: 409, code: "idempotency_key_reused" },
		"different verb"
	);
});

test("keys are per player", () => {
	remember("idem-c", KEY, start(100), response(1));
	assert.equal(replayOf("idem-d", KEY, start(999)), undefined);
});

test("forgetKeys wipes one player's keys only", () => {
	remember("idem-e", KEY, start(100), response(1));
	remember("idem-f", KEY, start(100), response(1));
	forgetKeys("idem-e");
	assert.equal(replayOf("idem-e", KEY, start(100)), undefined);
	assert.ok(replayOf("idem-f", KEY, start(100)));
});
