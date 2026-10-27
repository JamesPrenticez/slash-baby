// Run: pnpm test:server
// The round side of the debug surface: force, seed, reset, round/:roundId and the determinism rule (contract §10, §12).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { config } from "../config.ts";
import { debugRecord } from "../debug-state.ts";
import { draw, FIXTURES } from "../fixtures.ts";
import { payoutFor } from "../outcomes.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

const newPlayer = (currency?: string) => api.newDebugSession(`dbgr-${++count}`, currency);
const stateOf = async (token: string) => (await api.call("GET", "/api/debug/state", { token })).json;
const setSeed = (token: string, seed: unknown) => api.call("POST", "/api/debug/seed", { token, body: { seed } });
const debugRound = (token: string, roundId: string) => api.call("GET", `/api/debug/round/${roundId}`, { token });

/** Starts and settles `n` rounds of 100 and returns each round's debug info, oldest first. */
async function playRounds(token: string, n: number) {
	const infos = [];
	for (let i = 0; i < n; i++) {
		const { json } = await api.start(token, 100);
		await api.settle(token, json.roundId);
		infos.push((await debugRound(token, json.roundId)).json.debug);
	}
	return infos;
}

test("force by fixtureId gives exactly that fixture, and a non-sticky force is spent by one round", async () => {
	const { sessionToken: token } = await newPlayer();
	await setSeed(token, "force-seed");
	const forced = await api.force(token, { fixtureId: "jackpot_2" });
	assert.equal(forced.status, 200);
	assert.deepEqual(forced.json.force, { fixtureId: "jackpot_2", category: null, policy: null, sticky: false });

	const [first, second] = await playRounds(token, 2);
	assert.equal(first.fixtureId, "jackpot_2");
	assert.deepEqual(first.forced, { fixtureId: "jackpot_2", category: null, policy: null, sticky: false });
	assert.equal(second.fixtureId, draw("force-seed", 1).fixtureId, "back to the seeded draw");
	assert.equal(second.forced, null);
	assert.equal((await stateOf(token)).force, null);
});

test("a sticky force applies to every later round until it is cleared", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "loss", sticky: true });
	const rounds = await playRounds(token, 5);
	assert.ok(rounds.every(r => FIXTURES.find(f => f.fixtureId === r.fixtureId)!.category === "loss"));
	assert.equal((await stateOf(token)).force.sticky, true, "still there");

	const cleared = await api.force(token, null);
	assert.equal(cleared.status, 200);
	assert.equal(cleared.json.force, null);
	assert.equal((await playRounds(token, 1))[0].forced, null);
});

test("force by category picks a fixture of that category; policy alone picks any fixture of that policy", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "major_win", sticky: true });
	const majors = new Set((await playRounds(token, 12)).map(r => r.fixtureId));
	assert.ok(
		[...majors].every(id => id.startsWith("major_win")),
		[...majors].join()
	);
	assert.equal(majors.size, 2, "the seeded pick reaches both major_win fixtures");

	await api.force(token, { policy: "fixed" });
	const any = (await playRounds(token, 1))[0];
	assert.equal(any.forced.policy, "fixed");
});

test("fixtureId decides when the other fields disagree", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "loss_1", category: "jackpot" });
	assert.equal((await playRounds(token, 1))[0].fixtureId, "loss_1");
});

test("a force the server cannot honour is 400 invalid_debug_request and leaves the old force alone", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "big_win", sticky: true });
	const bad: unknown[] = [
		{},
		{ sticky: true },
		{ fixtureId: null, category: null, policy: null, sticky: false },
		{ fixtureId: "no-such-fixture" },
		{ fixtureId: 5 },
		{ category: "legendary" },
		{ category: 5 },
		{ policy: "free" },
		{ category: "loss", sticky: "yes" }
	];
	for (const body of bad) {
		const { status, json } = await api.call("POST", "/api/debug/force", { token, body });
		assert.equal(status, 400, JSON.stringify(body));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	assert.deepEqual(
		(await api.call("POST", "/api/debug/force", { token, rawBody: "[]" })).json.error.code,
		"invalid_debug_request"
	);
	assert.deepEqual((await stateOf(token)).force, { fixtureId: null, category: "big_win", policy: null, sticky: true });
});

test("forcing affects only new rounds, and a round that fails to start does not spend the force", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "loss" });
	const { json } = await api.start(token, 100);
	await api.force(token, { category: "jackpot" });
	assert.equal(
		(await api.call("GET", `/api/game/round/${json.roundId}`, { token })).json.round.outcome.category,
		"loss",
		"the open round keeps its outcome"
	);
	assert.equal((await api.start(token, 100)).json.error.code, "round_already_started");
	assert.equal((await stateOf(token)).force.category, "jackpot", "a rejected start spends nothing");
	assert.equal((await stateOf(token)).roundsPlayed, 1);
	await api.settle(token, json.roundId);
	assert.equal((await playRounds(token, 1))[0].forced.category, "jackpot");
});

test("seed sets the seed and restarts the round counter; null restores the default", async () => {
	const { sessionToken: token } = await newPlayer();
	await playRounds(token, 2);
	assert.equal((await stateOf(token)).roundsPlayed, 2);

	const seeded = await setSeed(token, "abc");
	assert.equal(seeded.status, 200);
	assert.equal(seeded.json.seed, "abc");
	assert.equal(seeded.json.roundsPlayed, 0);

	await playRounds(token, 1);
	const restored = await setSeed(token, null);
	assert.equal(restored.json.seed, config.defaultSeed);
	assert.equal(restored.json.roundsPlayed, 0);
});

test("seed rejects anything but a string of 1 to 64 characters or null", async () => {
	const { sessionToken: token } = await newPlayer();
	await setSeed(token, "kept");
	for (const seed of [undefined, 5, "", "x".repeat(65), [], {}, true]) {
		const { status, json } = await setSeed(token, seed);
		assert.equal(status, 400, JSON.stringify(seed));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	assert.equal((await setSeed(token, "x".repeat(64))).status, 200, "64 is the longest");
	assert.equal(
		(await api.call("POST", "/api/debug/seed", { token, rawBody: "[]" })).json.error.code,
		"invalid_debug_request"
	);
});

test("same seed and same round index give the same fixture, eventPlanId and payout, whoever plays", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	await setSeed(a.sessionToken, "shared-seed");
	await setSeed(b.sessionToken, "shared-seed");
	const fromA = await playRounds(a.sessionToken, 8);
	const fromB = await playRounds(b.sessionToken, 8);
	assert.deepEqual(
		fromA.map(r => r.fixtureId),
		fromB.map(r => r.fixtureId)
	);
	fromA.forEach((info, i) => {
		assert.equal(info.roundIndex, i);
		assert.equal(info.seed, "shared-seed");
		assert.equal(info.forced, null);
		assert.equal(info.fixtureId, draw("shared-seed", i).fixtureId, "draw(seed, roundIndex) reproduces the round");
	});

	await setSeed(a.sessionToken, "shared-seed");
	assert.deepEqual(
		(await playRounds(a.sessionToken, 8)).map(r => r.fixtureId),
		fromA.map(r => r.fixtureId),
		"re-seeding replays the run"
	);
});

test("a fixture always gives the same eventPlanId and payout for the same wager", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	const rounds = [];
	for (const { sessionToken: token } of [a, b]) {
		await api.force(token, { fixtureId: "big_win_1" });
		rounds.push((await api.start(token, 250)).json.message.round);
	}
	assert.equal(rounds[0].eventPlanId, rounds[1].eventPlanId);
	assert.equal(rounds[0].eventPlanId, "plan_big_win");
	assert.equal(rounds[0].outcome.payoutMinorUnits, rounds[1].outcome.payoutMinorUnits);
	assert.equal(
		rounds[0].outcome.payoutMinorUnits,
		payoutFor(250, FIXTURES.find(f => f.fixtureId === "big_win_1")!.multiplierBps)
	);
	assert.deepEqual(rounds[0].outcomePolicy, rounds[1].outcomePolicy);
});

test("a forced round consumes an index but never shifts what later rounds draw", async () => {
	const forcedRun = await newPlayer();
	const plainRun = await newPlayer();
	for (const { sessionToken: token } of [forcedRun, plainRun]) await setSeed(token, "shift-seed");
	await api.force(forcedRun.sessionToken, { fixtureId: "jackpot_1" });
	const withForce = await playRounds(forcedRun.sessionToken, 6);
	const without = await playRounds(plainRun.sessionToken, 6);

	assert.equal(withForce[0].fixtureId, "jackpot_1");
	assert.equal(withForce[0].roundIndex, 0, "the forced round took index 0");
	assert.deepEqual(
		withForce.slice(1).map(r => [r.roundIndex, r.fixtureId]),
		without.slice(1).map(r => [r.roundIndex, r.fixtureId]),
		"rounds 1 to 5 draw the same with or without the force on round 0"
	);
	assert.equal((await stateOf(forcedRun.sessionToken)).roundsPlayed, 6);
});

test("a forced category draw is keyed on (seed, round index) too", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	for (const { sessionToken: token } of [a, b]) {
		await setSeed(token, "cat-seed");
		await api.force(token, { category: "small_win", sticky: true });
	}
	assert.deepEqual(
		(await playRounds(a.sessionToken, 6)).map(r => r.fixtureId),
		(await playRounds(b.sessionToken, 6)).map(r => r.fixtureId)
	);
});

test("reset clears rounds, keys, force and simulation, restores the balance and counter, and keeps seed, currency and session", async () => {
	const { sessionToken: token, playerId } = await newPlayer("EUR");
	await setSeed(token, "survives-reset");
	await api.force(token, { category: "jackpot", sticky: true });
	const started = await api.start(token, 100, "reset-key-0123456789");
	await api.call("POST", "/api/debug/balance/set", { token, body: { balanceMinorUnits: 7 } });
	debugRecord(playerId).simulation.latencyMs = 250;

	const reset = await api.call("POST", "/api/debug/reset", { token, body: {} });
	assert.equal(reset.status, 200);
	assert.deepEqual(
		{ ...reset.json, fixtures: undefined, currencies: undefined },
		{
			mock: true,
			contractVersion: config.contractVersion,
			playerId,
			seed: "survives-reset",
			roundsPlayed: 0,
			force: null,
			simulation: { latencyMs: 0, errorRate: 0, failNext: null, dropAfterAccept: 0, resolveDelayMs: 0 },
			fixtures: undefined,
			currencies: undefined
		}
	);
	assert.deepEqual((await api.call("GET", "/api/game/balance", { token })).json, {
		balanceMinorUnits: config.startingBalanceMinorUnits,
		currency: "EUR"
	});
	assert.equal((await api.call("POST", "/api/game/current", { token, body: {} })).json.active, false);
	assert.equal((await api.call("GET", `/api/game/round/${started.json.roundId}`, { token })).status, 404);
	assert.equal((await debugRound(token, started.json.roundId)).status, 404);

	const again = await api.start(token, 100, "reset-key-0123456789");
	assert.equal(again.status, 200);
	assert.equal(again.json.message.replayed, undefined, "the key store was cleared, so this is a first processing");
	assert.equal(again.json.message.round.currency, "EUR");
	const { debug } = (await debugRound(token, again.json.roundId)).json;
	assert.deepEqual([debug.roundIndex, debug.forced], [0, null]);
	assert.equal(debug.fixtureId, draw("survives-reset", 0).fixtureId, "the kept seed, counter back at 0");
});

test("reset only touches the calling player", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	const { roundId } = (await api.start(b.sessionToken, 100)).json;
	await api.call("POST", "/api/debug/reset", { token: a.sessionToken, body: {} });
	assert.equal(
		(await api.call("POST", "/api/game/current", { token: b.sessionToken, body: {} })).json.round.roundId,
		roundId
	);
});

test("debug/round returns DebugRoundResponse: the plain round plus mock internals under debug", async () => {
	const { sessionToken: token } = await newPlayer();
	await setSeed(token, "round-info");
	const started = await api.start(token, 100, "info-start-key-0123456");
	const { roundId } = started.json;

	const { status, json } = await debugRound(token, roundId);
	assert.equal(status, 200);
	assert.deepEqual(Object.keys(json).sort(), ["debug", "round"]);
	assert.deepEqual(Object.keys(json.debug).sort(), [
		"fixtureId",
		"forced",
		"idempotencyKeys",
		"roundIndex",
		"seed",
		"statusHistory"
	]);
	const plain = await api.call("GET", `/api/game/round/${roundId}`, { token });
	assert.deepEqual(json.round, plain.json.round, "round is exactly what the game route returns");
	assert.equal("debug" in plain.json, false, "a non-debug response gains no debug field");
	assert.equal("debug" in started.json.message, false);

	assert.equal(json.debug.fixtureId, draw("round-info", 0).fixtureId);
	assert.equal(json.debug.seed, "round-info");
	assert.equal(json.debug.roundIndex, 0);
	assert.equal(json.debug.forced, null);
});

test("statusHistory and idempotencyKeys are in order, and a replayed key is not listed again", async () => {
	const { sessionToken: token } = await newPlayer();
	const { roundId } = (await api.start(token, 100, "key-start-0123456789")).json;
	await api.start(token, 100, "key-start-0123456789"); // replay
	await api.settle(token, roundId, "key-settle-1-0123456789");
	await api.settle(token, roundId, "key-settle-1-0123456789"); // replay
	await api.settle(token, roundId, "key-settle-2-0123456789"); // new key on a settled round
	await api.start(token, 100, "key-start-0123456789"); // replay of the first start after settle

	const { debug, round } = (await debugRound(token, roundId)).json;
	assert.deepEqual(
		debug.statusHistory.map((s: { status: string }) => s.status),
		["resolved", "settled"]
	);
	assert.deepEqual(
		debug.idempotencyKeys.map((k: { verb: string; key: string }) => [k.verb, k.key]),
		[
			["start", "key-start-0123456789"],
			["settle", "key-settle-1-0123456789"],
			["settle", "key-settle-2-0123456789"]
		]
	);
	for (const { at } of [...debug.statusHistory, ...debug.idempotencyKeys]) {
		assert.equal(new Date(at).toISOString(), at);
	}
	const times = debug.statusHistory.map((s: { at: string }) => Date.parse(s.at));
	assert.ok(times[0] <= times[1]);
	assert.equal(debug.statusHistory[0].at, round.createdAt, "the first entry is the status at creation");
	assert.equal(debug.statusHistory[1].at, round.settlement.settledAt);
});

test("debug/round shows the force in effect at start (a copy) and the seed at start", async () => {
	const { sessionToken: token } = await newPlayer();
	await setSeed(token, "at-start");
	await api.force(token, { category: "big_win", sticky: true });
	const { roundId } = (await api.start(token, 100)).json;
	await setSeed(token, "changed-later");
	await api.force(token, { category: "loss", sticky: true });

	const { debug } = (await debugRound(token, roundId)).json;
	assert.deepEqual(debug.forced, { fixtureId: null, category: "big_win", policy: null, sticky: true });
	assert.equal(debug.seed, "at-start");
	assert.ok(debug.fixtureId.startsWith("big_win"));
});

test("debug/round is 404 round_not_found for a missing round and for another player's", async () => {
	const owner = await newPlayer();
	const other = await newPlayer();
	const { roundId } = (await api.start(owner.sessionToken, 100)).json;
	for (const id of ["no-such-round", roundId]) {
		const { status, json } = await debugRound(other.sessionToken, id);
		assert.equal(status, 404, id);
		assert.equal(json.error.code, "round_not_found");
	}
});
