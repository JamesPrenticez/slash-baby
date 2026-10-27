// Run: pnpm test:server
// Per-player debug state (contract §10): defaults, seed, reset, and the failure stream counter.

import assert from "node:assert/strict";
import { test } from "node:test";

import { config } from "./config.ts";
import { debugRecord, debugStateOf, nextFailureRoll, resetDebug, setPlayerSeed } from "./debug-state.ts";
import { FIXTURES } from "./fixtures.ts";
import { failureRoll } from "./rng.ts";
import { createSession } from "./sessions.ts";

const NO_SIMULATION = { latencyMs: 0, errorRate: 0, failNext: null, dropAfterAccept: 0, resolveDelayMs: 0 };

test("a new player has the default seed, no force, no simulation and round counter 0", () => {
	assert.deepEqual(debugRecord("ds-new"), {
		seed: config.defaultSeed,
		roundsPlayed: 0,
		force: null,
		simulation: NO_SIMULATION,
		failureRolls: 0
	});
});

test("records are per player and mutable in place", () => {
	debugRecord("ds-a").roundsPlayed = 3;
	assert.equal(debugRecord("ds-a").roundsPlayed, 3);
	assert.equal(debugRecord("ds-b").roundsPlayed, 0);
});

test("setPlayerSeed sets the seed and restarts the counters; null restores the default", () => {
	const record = debugRecord("ds-seed");
	record.roundsPlayed = 4;
	record.failureRolls = 2;
	setPlayerSeed("ds-seed", "abc");
	assert.deepEqual([record.seed, record.roundsPlayed, record.failureRolls], ["abc", 0, 0]);
	record.roundsPlayed = 1;
	setPlayerSeed("ds-seed", null);
	assert.deepEqual([record.seed, record.roundsPlayed], [config.defaultSeed, 0]);
});

test("resetDebug clears force, simulation and counters but keeps the seed", () => {
	const record = debugRecord("ds-reset");
	setPlayerSeed("ds-reset", "keep-me");
	record.roundsPlayed = 5;
	record.failureRolls = 5;
	record.force = { fixtureId: null, category: "jackpot", policy: null, sticky: true };
	record.simulation.latencyMs = 250;
	record.simulation.failNext = { count: 2, status: 503 };
	resetDebug("ds-reset");
	assert.deepEqual(record, {
		seed: "keep-me",
		roundsPlayed: 0,
		force: null,
		simulation: NO_SIMULATION,
		failureRolls: 0
	});
});

test("nextFailureRoll walks the failure stream for the player's seed, one step per call", () => {
	setPlayerSeed("ds-fail", "fail-seed");
	const rolls = [nextFailureRoll("ds-fail"), nextFailureRoll("ds-fail"), nextFailureRoll("ds-fail")];
	assert.deepEqual(
		rolls,
		[0, 1, 2].map(n => failureRoll("fail-seed", n))
	);
	setPlayerSeed("ds-fail", "fail-seed");
	assert.equal(nextFailureRoll("ds-fail"), rolls[0], "a seed call restarts the stream");
});

test("debugStateOf is the DebugState wire shape", () => {
	const { player } = createSession("ds-state");
	setPlayerSeed("ds-state", "s");
	debugRecord("ds-state").roundsPlayed = 2;
	const state = debugStateOf(player);
	assert.deepEqual(Object.keys(state).sort(), [
		"contractVersion",
		"currencies",
		"fixtures",
		"force",
		"mock",
		"playerId",
		"roundsPlayed",
		"seed",
		"simulation"
	]);
	assert.equal(state.playerId, "ds-state");
	assert.equal(state.seed, "s");
	assert.equal(state.roundsPlayed, 2);
	assert.equal(state.fixtures.length, FIXTURES.length);
	assert.equal(state.mock, true);
	assert.deepEqual(state.simulation, NO_SIMULATION);
});
