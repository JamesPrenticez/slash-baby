// Run: pnpm test:server
// POST /api/game/play against the real handler: the envelope, `start`, `settle`, and idempotency (contract §4, §8, §9).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { config } from "../config.ts";
import { ownRound } from "../rounds.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

/** A debug player with its own wallet, so no test sees another's rounds. */
const newPlayer = async (balanceMinorUnits?: number) => {
	const session = await api.newDebugSession(`play-${++count}`);
	if (balanceMinorUnits !== undefined) {
		await api.call("POST", "/api/debug/balance/set", { token: session.sessionToken, body: { balanceMinorUnits } });
	}
	return session;
};

const balanceOf = async (token: string) =>
	(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits;
const KEY = "0123456789abcdef0123";

test("start debits the wager, creates a resolved Policy A round and returns the whole record", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "small_win_1" });
	const { status, json } = await api.start(token, 100);
	assert.equal(status, 200);
	assert.deepEqual(Object.keys(json).sort(), ["message", "roundId"]);
	assert.deepEqual(Object.keys(json.message).sort(), ["balanceMinorUnits", "round"]);
	assert.equal(json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
	const { round } = json.message;
	assert.equal(round.roundId, json.roundId);
	assert.match(round.roundId, /^[0-9a-f-]{36}$/);
	assert.equal(round.wagerMinorUnits, 100);
	assert.equal(round.currency, "USD");
	assert.equal(round.status, "resolved");
	assert.deepEqual(round.outcomePolicy, { type: "fixed", outcomeId: "small_win_1_outcome", payoutMinorUnits: 120 });
	assert.equal(round.eventPlanId, "plan_small_win");
	assert.equal(new Date(round.createdAt).toISOString(), round.createdAt);
	assert.equal(round.pendingDecision, null);
	assert.deepEqual(round.decisions, []);
	assert.equal(round.settlement, null);
	assert.deepEqual(round.outcome, {
		roundId: round.roundId,
		outcomeId: "small_win_1_outcome",
		category: "small_win",
		payoutMinorUnits: 120,
		presentationId: "victory",
		resolutionVersion: "mock-1"
	});
});

test("a wager that is not a safe integer in [min, max] is 400 invalid_bet and changes nothing", async () => {
	const { sessionToken: token } = await newPlayer();
	const bad = [100.5, "100", null, true, [100], { v: 100 }, -10, 0, 9, 50_001, 2 ** 60, undefined];
	for (const wager of bad) {
		const { status, json } = await api.call("POST", "/api/game/play", {
			token,
			body: { idempotencyKey: KEY, message: { start: { wagerMinorUnits: wager } } }
		});
		assert.equal(status, 400, String(wager));
		assert.equal(json.error.code, "invalid_bet", String(wager));
	}
	assert.equal(
		(
			await api.call("POST", "/api/game/play", {
				token,
				rawBody: `{"idempotencyKey":"${KEY}","message":{"start":{"wagerMinorUnits":1e999}}}`
			})
		).json.error.code,
		"invalid_bet",
		"Infinity is not a wager either"
	);
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits);
	assert.equal((await api.call("POST", "/api/game/current", { token, body: {} })).json.active, false);
	assert.equal((await api.call("GET", "/api/debug/state", { token })).json.roundsPlayed, 0);
});

test("the wager limits are inclusive: min and max are accepted", async () => {
	for (const wager of [config.minWagerMinorUnits, config.maxWagerMinorUnits]) {
		const { sessionToken: token } = await newPlayer();
		const { status, json } = await api.start(token, wager);
		assert.equal(status, 200, String(wager));
		assert.equal(json.message.round.wagerMinorUnits, wager);
	}
});

test("a wager above the balance is 402 insufficient_balance; exactly the balance is allowed", async () => {
	const { sessionToken: token } = await newPlayer(50);
	const refused = await api.start(token, 100);
	assert.equal(refused.status, 402);
	assert.equal(refused.json.error.code, "insufficient_balance");
	assert.equal(await balanceOf(token), 50);
	assert.equal((await api.call("GET", "/api/debug/state", { token })).json.roundsPlayed, 0, "no round index consumed");

	const exact = await api.start(token, 50);
	assert.equal(exact.status, 200);
	assert.equal(exact.json.message.balanceMinorUnits, 0);
});

test("a round is accepted once: a second start under a new key is 409, the same key replays", async () => {
	const { sessionToken: token } = await newPlayer();
	const first = await api.start(token, 100, KEY);
	const balanceAfter = first.json.message.balanceMinorUnits;

	const second = await api.start(token, 100);
	assert.equal(second.status, 409);
	assert.equal(second.json.error.code, "round_already_started");

	const replay = await api.start(token, 100, KEY);
	assert.equal(replay.status, 200);
	assert.equal(replay.json.roundId, first.json.roundId);
	assert.equal(replay.json.message.replayed, true);
	assert.deepEqual(replay.json.message.round, first.json.message.round);
	assert.equal(await balanceOf(token), balanceAfter, "debited once");
	assert.equal((await api.call("GET", "/api/debug/state", { token })).json.roundsPlayed, 1);
});

test("round_already_started wins over insufficient_balance when a round is open", async () => {
	const { sessionToken: token } = await newPlayer(100);
	await api.start(token, 100);
	assert.equal((await api.start(token, 100)).json.error.code, "round_already_started");
});

test("a replayed start returns the response as it was at start, even after the round settled", async () => {
	const { sessionToken: token } = await newPlayer();
	const first = await api.start(token, 100, KEY);
	await api.settle(token, first.json.roundId);
	const replay = await api.start(token, 100, KEY);
	assert.equal(replay.json.message.round.status, "resolved");
	assert.equal(replay.json.message.round.settlement, null);
	assert.equal(replay.json.message.balanceMinorUnits, first.json.message.balanceMinorUnits);
});

test("idempotency keys are per player", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	const first = await api.start(a.sessionToken, 100, KEY);
	const other = await api.start(b.sessionToken, 100, KEY);
	assert.equal(other.status, 200);
	assert.equal(other.json.message.replayed, undefined);
	assert.notEqual(other.json.roundId, first.json.roundId);
});

test("the same key with a different message is 409 idempotency_key_reused", async () => {
	const { sessionToken: token } = await newPlayer();
	const first = await api.start(token, 100, KEY);
	for (const reuse of [api.start(token, 200, KEY), api.settle(token, first.json.roundId, KEY)]) {
		const { status, json } = await reuse;
		assert.equal(status, 409);
		assert.equal(json.error.code, "idempotency_key_reused");
	}
	assert.equal((await api.start(token, 100, KEY)).json.message.replayed, true, "the original still replays");
});

test("a rejected request is not stored, so the key can be retried once the cause is fixed", async () => {
	const { sessionToken: token } = await newPlayer(50);
	assert.equal((await api.start(token, 100, KEY)).status, 402);
	await api.call("POST", "/api/debug/balance/credit", { token, body: { amountMinorUnits: 1000 } });
	const retry = await api.start(token, 100, KEY);
	assert.equal(retry.status, 200);
	assert.equal(retry.json.message.replayed, undefined, "a first processing, not a replay");
	assert.equal(retry.json.message.balanceMinorUnits, 950);
});

test("the envelope: idempotencyKey must be a string of 16 to 64 characters", async () => {
	const { sessionToken: token } = await newPlayer();
	const message = { start: { wagerMinorUnits: 100 } };
	for (const idempotencyKey of [undefined, null, 5, "", "x".repeat(15), "x".repeat(65), ["x".repeat(16)]]) {
		const { status, json } = await api.call("POST", "/api/game/play", { token, body: { idempotencyKey, message } });
		assert.equal(status, 400, JSON.stringify(idempotencyKey));
		assert.equal(json.error.code, "invalid_request");
	}
	assert.equal((await api.start(token, 100, "x".repeat(16))).status, 200, "16 is the shortest");
	await api.settle(token, (await api.call("POST", "/api/game/current", { token, body: {} })).json.round.roundId);
	assert.equal((await api.start(token, 100, "x".repeat(64))).status, 200, "64 is the longest");
});

test("the envelope: the body is an object and message holds exactly one known verb", async () => {
	const { sessionToken: token } = await newPlayer();
	const send = (body: unknown) => api.call("POST", "/api/game/play", { token, body });
	for (const body of [[], "x", null, 5]) {
		const { status, json } = await send(body);
		assert.equal(status, 400, JSON.stringify(body));
		assert.equal(json.error.code, "invalid_request");
	}
	const start = { wagerMinorUnits: 100 };
	const settle = { roundId: "r" };
	const messages = [undefined, null, "start", [], {}, { bogus: {} }, { start, settle }, { start, bogus: 1, settle }];
	for (const message of messages) {
		const { status, json } = await send({ idempotencyKey: KEY, message });
		assert.equal(status, 400, JSON.stringify(message));
		assert.equal(json.error.code, "invalid_message", JSON.stringify(message));
	}
	for (const message of [
		{ start: null },
		{ start: 5 },
		{ start: [] },
		{ settle: "r1" },
		{ settle: {} },
		{ settle: { roundId: 5 } }
	]) {
		const { status, json } = await send({ idempotencyKey: KEY, message });
		assert.equal(status, 400, JSON.stringify(message));
		assert.equal(json.error.code, "invalid_request", JSON.stringify(message));
	}
	assert.equal(
		(await send({ idempotencyKey: KEY, message: { start: { wagerMinorUnits: 100 }, extra: 1 } })).status,
		200
	);
});

test("play needs a valid bearer token", async () => {
	const body = { idempotencyKey: KEY, message: { start: { wagerMinorUnits: 100 } } };
	for (const token of [undefined, "nope"]) {
		const { status, json } = await api.call("POST", "/api/game/play", { token, body });
		assert.equal(status, 401);
		assert.equal(json.error.code, "invalid_session");
	}
});

test("settle credits the payout once, moves the round to settled and frees the player to bet again", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "small_win_1" });
	const started = await api.start(token, 100);
	const { roundId } = started.json;
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits - 100, "the payout is not credited at start");

	const { status, json } = await api.settle(token, roundId);
	assert.equal(status, 200);
	assert.equal(json.roundId, roundId);
	assert.equal(json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100 + 120);
	const { round } = json.message;
	assert.equal(round.status, "settled");
	assert.deepEqual(Object.keys(round.settlement).sort(), [
		"currency",
		"payoutMinorUnits",
		"roundId",
		"settledAt",
		"settlementId",
		"wagerMinorUnits"
	]);
	assert.equal(round.settlement.roundId, roundId);
	assert.equal(round.settlement.wagerMinorUnits, 100);
	assert.equal(round.settlement.payoutMinorUnits, 120);
	assert.equal(round.settlement.currency, "USD");
	assert.equal(new Date(round.settlement.settledAt).toISOString(), round.settlement.settledAt);
	assert.deepEqual(round.outcome, started.json.message.round.outcome, "settling does not touch the outcome");

	assert.equal((await api.call("POST", "/api/game/current", { token, body: {} })).json.active, false);
	assert.equal((await api.start(token, 100)).status, 200);
});

test("a losing round settles for zero", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "loss" });
	const { json } = await api.start(token, 100);
	const settled = await api.settle(token, json.roundId);
	assert.equal(settled.json.message.round.settlement.payoutMinorUnits, 0);
	assert.equal(settled.json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
});

test("settlement is idempotent: the same key replays, any other key returns the stored settlement and credits nothing", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "standard_win_1" });
	const { roundId } = (await api.start(token, 100)).json;
	const first = await api.settle(token, roundId, KEY);
	const balance = first.json.message.balanceMinorUnits;
	assert.equal(balance, config.startingBalanceMinorUnits - 100 + 200);

	const sameKey = await api.settle(token, roundId, KEY);
	assert.equal(sameKey.status, 200);
	assert.equal(sameKey.json.message.replayed, true);
	assert.deepEqual(sameKey.json.message.round, first.json.message.round);

	for (let i = 0; i < 3; i++) {
		const again = await api.settle(token, roundId);
		assert.equal(again.status, 200);
		assert.equal(again.json.message.replayed, undefined, "a new key is a new request, not a replay");
		assert.equal(again.json.message.balanceMinorUnits, balance);
		assert.deepEqual(again.json.message.round.settlement, first.json.message.round.settlement);
	}
	assert.equal(await balanceOf(token), balance, "credited exactly once");
});

test("a round cannot be settled as both a win and a loss, and later forcing never rewrites it", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { category: "loss" });
	const { roundId } = (await api.start(token, 100)).json;
	await api.force(token, { category: "jackpot", sticky: true });
	const first = await api.settle(token, roundId);
	const second = await api.settle(token, roundId);
	for (const { json } of [first, second]) {
		assert.equal(json.message.round.outcome.category, "loss");
		assert.equal(json.message.round.settlement.payoutMinorUnits, 0);
		assert.equal(json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
	}
	const read = await api.call("GET", `/api/game/round/${roundId}`, { token });
	assert.equal(read.json.round.outcome.category, "loss");
});

test("settle on an unknown round, or another player's, is 404 round_not_found and credits nobody", async () => {
	const owner = await newPlayer();
	const intruder = await newPlayer();
	await api.force(owner.sessionToken, { fixtureId: "jackpot_1" });
	const { roundId } = (await api.start(owner.sessionToken, 100)).json;

	for (const id of ["no-such-round", roundId]) {
		const { status, json } = await api.settle(intruder.sessionToken, id);
		assert.equal(status, 404, id);
		assert.equal(json.error.code, "round_not_found");
	}
	assert.equal(await balanceOf(intruder.sessionToken), config.startingBalanceMinorUnits);
	const read = await api.call("GET", `/api/game/round/${roundId}`, { token: owner.sessionToken });
	assert.equal(read.json.round.status, "resolved", "the owner's round is untouched");
});

test("settle before the round is resolved is 409 round_not_resolved", async () => {
	const { sessionToken: token, playerId } = await newPlayer();
	const { roundId } = (await api.start(token, 100)).json;
	// The mock resolves Policy A rounds at start, so reach the unresolved states directly (W3 decision rounds will).
	for (const status of ["running", "awaiting_choice", "accepted"] as const) {
		ownRound(playerId, roundId).record.status = status;
		const { status: http, json } = await api.settle(token, roundId);
		assert.equal(http, 409, status);
		assert.equal(json.error.code, "round_not_resolved");
	}
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits - 100);
});

test("decide is validated and, with no decision points yet, never has anything to answer", async () => {
	const { sessionToken: token } = await newPlayer();
	const { roundId } = (await api.start(token, 100)).json;
	const decide = { roundId, decisionId: "d1", optionId: "o1", sequenceNumber: 1 };

	const resolved = await api.play(token, { decide });
	assert.equal(resolved.status, 409);
	assert.equal(resolved.json.error.code, "round_not_awaiting_choice");

	const missing = await api.play(token, { decide: { ...decide, roundId: "nope" } });
	assert.equal(missing.status, 404);
	assert.equal(missing.json.error.code, "round_not_found");

	for (const patch of [
		{ roundId: 5 },
		{ decisionId: 5 },
		{ optionId: null },
		{ sequenceNumber: "1" },
		{ sequenceNumber: 1.5 }
	]) {
		const { status, json } = await api.play(token, { decide: { ...decide, ...patch } as never });
		assert.equal(status, 400, JSON.stringify(patch));
		assert.equal(json.error.code, "invalid_request");
	}
});

test("every money field in a round is a safe integer", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "big_win_2" });
	const started = await api.start(token, 333);
	const settled = await api.settle(token, started.json.roundId);
	const { round, balanceMinorUnits } = settled.json.message;
	for (const value of [
		balanceMinorUnits,
		round.wagerMinorUnits,
		round.outcome.payoutMinorUnits,
		round.outcomePolicy.payoutMinorUnits,
		round.settlement.payoutMinorUnits
	]) {
		assert.ok(Number.isSafeInteger(value), String(value));
	}
	assert.equal(round.outcome.payoutMinorUnits, 3330, "floor(333 * 100000 / 10000)");
});
