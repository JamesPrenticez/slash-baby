// Run: pnpm test:server
// Recovery matrix (contract §9, BUILD-PLAN §13 #2, #8, #9, #13, #15): a request whose answer is lost can be replayed with
// the same key, `current` shows the authoritative round, and no sequence of keys or concurrent calls can double-debit
// or double-pay. Real handler, real sockets, ephemeral port.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { config } from "./config.ts";
import { startTestServer } from "./testing.ts";
import type { PlayMessage } from "../../src/types/api.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});
after(() => api.close());

const keyOf = () => `recovery-key-${String(++count).padStart(8, "0")}`;
const player = async () => (await api.newDebugSession(`recovery-${++count}`)).sessionToken;
const simulate = (token: string, body: unknown) => api.call("POST", "/api/debug/simulate", { token, body });
const current = async (token: string) => (await api.call("POST", "/api/game/current", { token, body: {} })).json;
const dropped = (promise: Promise<unknown>) =>
	promise.then(
		() => assert.fail("expected the connection to be dropped"),
		() => undefined
	);

/** Sends `message` with the connection dropped after the server accepted it; the caller sees a network error. */
async function playDropped(token: string, message: PlayMessage, key: string) {
	await simulate(token, { dropAfterAccept: 1 });
	await dropped(api.play(token, message, key));
}

const weaponDecision = (roundId: string, sequenceNumber = 1): PlayMessage => ({
	decide: {
		roundId,
		decisionId: sequenceNumber === 1 ? "weapon_choice" : "weapon_evolution",
		optionId: sequenceNumber === 1 ? "twin_daggers" : "keep",
		sequenceNumber
	}
});

test("start dropped after accept: current has the round, the same key replays it, one debit", async () => {
	const token = await player();
	const key = keyOf();
	await playDropped(token, { start: { wagerMinorUnits: 100 } }, key);

	const view = await current(token);
	assert.equal(view.active, true);
	assert.equal(view.balanceMinorUnits, config.startingBalanceMinorUnits - 100);

	const replay = await api.start(token, 100, key);
	assert.equal(replay.status, 200);
	assert.equal(replay.json.message.replayed, true);
	assert.equal(replay.json.roundId, view.round.roundId);
	assert.equal(replay.json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits - 100
	);
	assert.equal((await api.call("GET", "/api/debug/state", { token })).json.roundsPlayed, 1);
});

test("decide dropped after accept: current shows the decision, the same key replays, one decision recorded", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "evolution_big" });
	const { roundId } = (await api.start(token, 100)).json;
	const key = keyOf();
	await playDropped(token, weaponDecision(roundId), key);

	const view = await current(token);
	assert.equal(view.round.decisions.length, 1);
	assert.equal(view.round.pendingDecision.id, "weapon_evolution");

	const replay = await api.play(token, weaponDecision(roundId), key);
	assert.equal(replay.status, 200);
	assert.equal(replay.json.message.replayed, true);
	assert.equal((await current(token)).round.decisions.length, 1);

	const other = await api.play(token, weaponDecision(roundId));
	assert.equal(other.status, 409, "a new key for the recorded decision is refused");
	assert.equal(other.json.error.code, "decision_already_recorded");
});

test("settle dropped after accept: the same key replays, the payout is credited once", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "small_win_1" });
	const { roundId } = (await api.start(token, 100)).json;
	const key = keyOf();
	await playDropped(token, { settle: { roundId } }, key);

	const expected = config.startingBalanceMinorUnits - 100 + 120;
	const view = await current(token);
	assert.equal(view.active, false, "the round is settled, so nothing is open");
	assert.equal(view.balanceMinorUnits, expected);

	const replay = await api.settle(token, roundId, key);
	assert.equal(replay.status, 200);
	assert.equal(replay.json.message.replayed, true);
	assert.equal(replay.json.message.round.status, "settled");
	assert.equal(replay.json.message.balanceMinorUnits, expected);
	assert.equal((await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits, expected);
});

test("a dropped reply that is never replayed leaves a round current can finish", async () => {
	const token = await player();
	await playDropped(token, { start: { wagerMinorUnits: 100 } }, keyOf());
	const { round } = await current(token);
	assert.equal(round.status, "resolved");
	const settled = await api.settle(token, round.roundId);
	assert.equal(settled.status, 200);
	assert.equal(settled.json.message.round.status, "settled");
});

test("reload mid-decision: a new session for the same player gets the pending decision from current", async () => {
	const id = `recovery-reload-${++count}`;
	const before = await api.newDebugSession(id);
	await api.force(before.sessionToken, { fixtureId: "evolution_big" });
	const { roundId } = (await api.start(before.sessionToken, 100)).json;
	await api.play(before.sessionToken, weaponDecision(roundId));

	const after = await api.newDebugSession(id);
	assert.notEqual(after.sessionToken, before.sessionToken);
	assert.equal(after.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
	const view = await current(after.sessionToken);
	assert.equal(view.active, true);
	assert.equal(view.round.roundId, roundId);
	assert.equal(view.round.status, "awaiting_choice");
	assert.equal(view.round.pendingDecision.id, "weapon_evolution");
	assert.equal(view.round.decisions.length, 1);
});

test("settling twice, under different keys, credits once and returns the same settlement", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "big_win_1" });
	const { roundId } = (await api.start(token, 100)).json;
	const first = await api.settle(token, roundId);
	const second = await api.settle(token, roundId);
	assert.equal(second.status, 200);
	assert.equal(second.json.message.round.settlement.settlementId, first.json.message.round.settlement.settlementId);
	assert.equal(second.json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100 + 500);
	assert.equal((await api.call("GET", "/api/game/history", { token })).json.total, 1);
});

test("concurrent starts with different keys: exactly one round and one debit", async () => {
	const token = await player();
	const replies = await Promise.all(Array.from({ length: 5 }, () => api.start(token, 100)));
	assert.deepEqual(replies.map(r => r.status).sort(), [200, 409, 409, 409, 409]);
	for (const r of replies.filter(r => r.status === 409)) assert.equal(r.json.error.code, "round_already_started");
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits - 100
	);
	assert.equal((await api.call("GET", "/api/debug/state", { token })).json.roundsPlayed, 1);
});

test("concurrent starts with the same key: one round, the rest are replays", async () => {
	const token = await player();
	const key = keyOf();
	const replies = await Promise.all(Array.from({ length: 5 }, () => api.start(token, 100, key)));
	assert.ok(replies.every(r => r.status === 200));
	assert.equal(new Set(replies.map(r => r.json.roundId)).size, 1);
	assert.equal(replies.filter(r => r.json.message.replayed).length, 4);
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits - 100
	);
});

test("concurrent settles with different keys credit once", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "standard_win_1" });
	const { roundId } = (await api.start(token, 100)).json;
	const replies = await Promise.all(Array.from({ length: 5 }, () => api.settle(token, roundId)));
	assert.ok(replies.every(r => r.status === 200));
	assert.equal(new Set(replies.map(r => r.json.message.round.settlement.settlementId)).size, 1);
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits - 100 + 200
	);
});

test("the same key with a different body is 409 idempotency_key_reused for every verb, and changes nothing", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "evolution_big" });
	const startKey = keyOf();
	const { roundId } = (await api.start(token, 100, startKey)).json;
	const decideKey = keyOf();
	await api.play(token, weaponDecision(roundId), decideKey);

	const reused = async (message: PlayMessage, key: string) => {
		const r = await api.play(token, message, key);
		assert.equal(r.status, 409, JSON.stringify(message));
		assert.equal(r.json.error.code, "idempotency_key_reused");
	};
	await reused({ start: { wagerMinorUnits: 200 } }, startKey);
	await reused(
		{ decide: { roundId, decisionId: "weapon_choice", optionId: "shadow_blades", sequenceNumber: 1 } },
		decideKey
	);
	await reused({ settle: { roundId } }, decideKey);

	await api.play(token, weaponDecision(roundId, 2));
	const settleKey = keyOf();
	await api.settle(token, roundId, settleKey);
	await reused({ settle: { roundId: "another-round" } }, settleKey);

	const balance = (await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits;
	assert.equal(balance, config.startingBalanceMinorUnits - 100 + 500);
});

test("a round of another player is 404 for read, decide and settle, and changes nothing for either player", async () => {
	const owner = await player();
	const intruder = await player();
	await api.force(owner, { fixtureId: "dagger_choice_small" });
	const { roundId } = (await api.start(owner, 100)).json;

	const reads = [
		await api.call("GET", `/api/game/round/${roundId}`, { token: intruder }),
		await api.call("GET", `/api/debug/round/${roundId}`, { token: intruder }),
		await api.play(intruder, weaponDecision(roundId)),
		await api.settle(intruder, roundId)
	];
	for (const r of reads) {
		assert.equal(r.status, 404);
		assert.equal(r.json.error.code, "round_not_found");
	}
	assert.equal((await current(intruder)).active, false);
	assert.equal((await current(intruder)).balanceMinorUnits, config.startingBalanceMinorUnits);
	const view = await current(owner);
	assert.equal(view.round.status, "awaiting_choice");
	assert.equal(view.round.decisions.length, 0);
});

test("idempotency keys are per player: another player's key is not a replay", async () => {
	const a = await player();
	const b = await player();
	const key = keyOf();
	const first = await api.start(a, 100, key);
	const second = await api.start(b, 100, key);
	assert.equal(second.status, 200);
	assert.equal(second.json.message.replayed, undefined);
	assert.notEqual(second.json.roundId, first.json.roundId);
});

test("a failed attempt (simulated 503) applied nothing and the same key then succeeds once", async () => {
	const token = await player();
	const key = keyOf();
	await simulate(token, { failNext: { count: 1, status: 503 } });
	assert.equal((await api.start(token, 100, key)).status, 503);
	assert.equal((await current(token)).active, false);
	assert.equal((await current(token)).balanceMinorUnits, config.startingBalanceMinorUnits);

	const retry = await api.start(token, 100, key);
	assert.equal(retry.status, 200);
	assert.equal(retry.json.message.replayed, undefined);
	assert.equal(retry.json.message.balanceMinorUnits, config.startingBalanceMinorUnits - 100);
});

test("a Policy A choice never changes the payout; a stale decision after a replay cannot rewrite it", async () => {
	const payouts = new Set<number>();
	for (const optionId of ["twin_daggers", "shadow_blades"]) {
		const token = await player();
		await api.force(token, { fixtureId: "dagger_choice_small" });
		const { roundId } = (await api.start(token, 100)).json;
		const key = keyOf();
		const message: PlayMessage = { decide: { roundId, decisionId: "weapon_choice", optionId, sequenceNumber: 1 } };
		const decided = await api.play(token, message, key);
		payouts.add(decided.json.message.round.outcome.payoutMinorUnits);
		const stale = await api.play(token, {
			decide: { roundId, decisionId: "weapon_choice", optionId: "twin_daggers", sequenceNumber: 1 }
		});
		assert.equal(stale.status, 409);
		const settled = await api.settle(token, roundId);
		assert.equal(settled.json.message.round.settlement.payoutMinorUnits, 150);
	}
	assert.deepEqual([...payouts], [150]);
});
