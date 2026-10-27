// Run: pnpm test:server
// The `decide` verb, awaiting_choice, Policy A and B resolution, resolveDelayMs, and GET /api/game/history
// (contract §4, §6; BUILD-PLAN §12 Phase 5, §13 #5 to #7). Request-level, against the real handler.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import type { RoundRecord } from "../../../src/types/round.ts";
import { debugRecord } from "../debug-state.ts";
import { FIXTURES } from "../fixtures.ts";
import { payoutFor } from "../outcomes.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

const newPlayer = async () => {
	const name = `decide-${++count}`;
	const session = await api.newDebugSession(name);
	return { token: session.sessionToken, name };
};

const decideMsg = (round: RoundRecord, optionId: string, extra: Record<string, unknown> = {}) => ({
	decide: {
		roundId: round.roundId,
		decisionId: round.pendingDecision!.id,
		optionId,
		sequenceNumber: round.decisions.length + 1,
		...extra
	}
});

/** Forces a fixture, starts a round and returns its record. */
async function startFixture(token: string, fixtureId: string, wager = 100): Promise<RoundRecord> {
	await api.force(token, { fixtureId });
	const { status, json } = await api.start(token, wager);
	assert.equal(status, 200, JSON.stringify(json));
	return json.message.round;
}

/** Decides the pending decision with `optionId` and returns the new record. */
async function decide(token: string, round: RoundRecord, optionId: string) {
	const reply = await api.play(token, decideMsg(round, optionId));
	assert.equal(reply.status, 200, JSON.stringify(reply.json));
	return reply.json.message.round as RoundRecord;
}

const roundOf = async (token: string, roundId: string): Promise<RoundRecord> =>
	(await api.call("GET", `/api/game/round/${roundId}`, { token })).json.round;

test("a fixture with decisions starts awaiting_choice with the first decision pending and no outcome", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "dagger_choice_small");
	assert.equal(round.status, "awaiting_choice");
	assert.equal(round.outcome, null);
	assert.deepEqual(round.decisions, []);
	assert.equal(round.pendingDecision?.id, "weapon_choice");
	assert.deepEqual(
		round.pendingDecision?.options.map(o => o.id),
		["twin_daggers", "shadow_blades"]
	);
	assert.deepEqual(round.outcomePolicy, {
		type: "fixed",
		outcomeId: "dagger_choice_small_outcome",
		payoutMinorUnits: 150
	});
	assert.equal(round.settlement, null);
	const { json } = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(json.active, true);
	assert.equal(json.round.status, "awaiting_choice", "a reload resumes the same pending decision");
	assert.deepEqual(json.round.pendingDecision, round.pendingDecision);
});

test("the Policy B fixture starts with a choice_constrained policy and no payout", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "vault_route");
	assert.equal(round.status, "awaiting_choice");
	assert.equal(round.pendingDecision?.outcomeEffect, "authoritative_resolution");
	assert.equal(round.outcome, null);
	assert.equal(round.outcomePolicy.type, "choice_constrained");
	if (round.outcomePolicy.type === "choice_constrained") {
		assert.deepEqual(round.outcomePolicy.permittedChoices, ["safe_route", "risky_vault"]);
		assert.ok(round.outcomePolicy.resolutionRef);
		assert.ok(!("payoutMinorUnits" in round.outcomePolicy));
	}
});

test("a valid decision is recorded once, the next one becomes pending, the last resolves the round", async () => {
	const { token, name } = await newPlayer();
	const first = await startFixture(token, "evolution_big");
	const afterFirst = await decide(token, first, "shadow_blades");
	assert.equal(afterFirst.status, "awaiting_choice");
	assert.deepEqual(afterFirst.decisions, [
		{ roundId: first.roundId, decisionId: "weapon_choice", optionId: "shadow_blades", sequenceNumber: 1 }
	]);
	assert.equal(afterFirst.pendingDecision?.id, "weapon_evolution");
	assert.equal(afterFirst.outcome, null);

	const last = await decide(token, afterFirst, "keep");
	assert.equal(last.status, "resolved");
	assert.equal(last.pendingDecision, null);
	assert.equal(last.decisions.length, 2);
	assert.equal(last.outcome?.payoutMinorUnits, 500);
	assert.equal(last.outcome?.category, "big_win");
	assert.equal(last.outcome?.payoutMinorUnits, (last.outcomePolicy as { payoutMinorUnits: number }).payoutMinorUnits);

	const debug = (await api.call("GET", `/api/debug/round/${first.roundId}`, { token })).json.debug;
	assert.deepEqual(
		debug.statusHistory.map((s: { status: string }) => s.status),
		["awaiting_choice", "resolved"]
	);
	assert.deepEqual(
		debug.idempotencyKeys.map((k: { verb: string }) => k.verb),
		["start", "decide", "decide"]
	);
	assert.ok(name);
});

test("a decision response has the PlayResponse shape and settle then pays the fixed amount once", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "dagger_choice_small", 200);
	const reply = await api.play(token, decideMsg(round, "twin_daggers"));
	assert.deepEqual(Object.keys(reply.json).sort(), ["message", "roundId"]);
	assert.deepEqual(Object.keys(reply.json.message).sort(), ["balanceMinorUnits", "round"]);
	assert.equal(reply.json.roundId, round.roundId);
	assert.equal(reply.json.message.balanceMinorUnits, 100_000 - 200);
	const settled = await api.settle(token, round.roundId);
	assert.equal(settled.json.message.balanceMinorUnits, 100_000 - 200 + 300);
});

test("only options of the pending decision are accepted (invalid_option), and nothing is recorded", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "evolution_big");
	for (const optionId of ["evolve", "", "nope", "SAFE_ROUTE", "twin_daggers "]) {
		const reply = await api.play(token, decideMsg(round, optionId));
		assert.equal(reply.status, 400, optionId);
		assert.equal(reply.json.error.code, "invalid_option");
	}
	const now = await roundOf(token, round.roundId);
	assert.deepEqual(now.decisions, []);
	assert.equal(now.pendingDecision?.id, "weapon_choice");
	assert.equal(
		(await decide(token, now, "twin_daggers")).decisions.length,
		1,
		"the same keyless retry works afterwards"
	);
});

test("a rejected decision is not stored, so its key can be reused once the cause is gone", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "evolution_loss");
	const key = randomUUID();
	assert.equal((await api.play(token, decideMsg(round, "twin_daggers"), key)).status, 400);
	const ok = await api.play(token, decideMsg(round, "keep"), key);
	assert.equal(ok.status, 200, "the rejected attempt left nothing stored under the key");
});

test("a stale decision (wrong decisionId or sequence number) is 409 stale_decision", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "evolution_big");
	const cases = [
		{ decisionId: "weapon_evolution" },
		{ decisionId: "nope" },
		{ sequenceNumber: 2 },
		{ sequenceNumber: 5 },
		{ sequenceNumber: 0 },
		{ sequenceNumber: -1 }
	];
	for (const extra of cases) {
		const reply = await api.play(token, decideMsg(round, "twin_daggers", extra));
		assert.equal(reply.status, 409, JSON.stringify(extra));
		assert.equal(reply.json.error.code, "stale_decision", JSON.stringify(extra));
	}
	assert.deepEqual((await roundOf(token, round.roundId)).decisions, []);
});

test("a repeated decision is applied once: same key replays, another key is decision_already_recorded", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "evolution_big");
	const message = decideMsg(round, "twin_daggers");
	const key = randomUUID();
	const first = await api.play(token, message, key);
	const again = await api.play(token, message, key);
	assert.equal(again.status, 200);
	assert.equal(again.json.message.replayed, true);
	assert.deepEqual({ ...again.json.message, replayed: undefined }, { ...first.json.message, replayed: undefined });
	assert.equal((await roundOf(token, round.roundId)).decisions.length, 1);

	const other = await api.play(token, message);
	assert.equal(other.status, 409);
	assert.equal(other.json.error.code, "decision_already_recorded");
	const otherOption = await api.play(token, decideMsg(round, "shadow_blades"));
	assert.equal(otherOption.json.error.code, "decision_already_recorded", "a changed mind is not applied");

	const reused = await api.play(token, decideMsg(round, "shadow_blades"), key);
	assert.equal(reused.status, 409);
	assert.equal(reused.json.error.code, "idempotency_key_reused");
	const final = await roundOf(token, round.roundId);
	assert.equal(final.decisions.length, 1);
	assert.equal(final.decisions[0].optionId, "twin_daggers");
});

test("deciding with no decision pending is 409 round_not_awaiting_choice; an unknown or foreign round is 404", async () => {
	const { token } = await newPlayer();
	await api.force(token, { fixtureId: "small_win_1" });
	const plain: RoundRecord = (await api.start(token, 100)).json.message.round;
	const message = {
		decide: { roundId: plain.roundId, decisionId: "weapon_choice", optionId: "twin_daggers", sequenceNumber: 1 }
	};
	assert.equal((await api.play(token, message)).json.error.code, "round_not_awaiting_choice");
	await api.settle(token, plain.roundId);
	assert.equal((await api.play(token, message)).json.error.code, "round_not_awaiting_choice", "settled round");

	const done = await startFixture(token, "evolution_loss");
	const resolved = await decide(token, done, "evolve");
	assert.equal(resolved.status, "resolved");
	const late = await api.play(token, {
		decide: { roundId: done.roundId, decisionId: "weapon_evolution", optionId: "keep", sequenceNumber: 2 }
	});
	assert.equal(late.json.error.code, "round_not_awaiting_choice");
	const dup = await api.play(token, {
		decide: { roundId: done.roundId, decisionId: "weapon_evolution", optionId: "keep", sequenceNumber: 1 }
	});
	assert.equal(dup.json.error.code, "decision_already_recorded");

	const missing = await api.play(token, { decide: { ...message.decide, roundId: randomUUID() } });
	assert.equal(missing.status, 404);
	assert.equal(missing.json.error.code, "round_not_found");
	const stranger = await newPlayer();
	const foreign = await api.play(stranger.token, { decide: { ...message.decide, roundId: done.roundId } });
	assert.equal(foreign.status, 404);
});

test("an unsettled round that is awaiting_choice cannot be settled, and blocks a new start", async () => {
	const { token } = await newPlayer();
	const round = await startFixture(token, "vault_route");
	const settle = await api.settle(token, round.roundId);
	assert.equal(settle.status, 409);
	assert.equal(settle.json.error.code, "round_not_resolved");
	assert.equal((await api.start(token, 100)).json.error.code, "round_already_started");
});

// BUILD-PLAN §13 #4 and #5-#6 as a property: no fixture and no option sequence changes a fixed payout.
test("property: for every Policy A fixture and every option sequence, the payout equals the policy payout", async () => {
	const { token } = await newPlayer();
	let rounds = 0;
	for (const fixture of FIXTURES.filter(f => f.policy === "fixed")) {
		const sequences = fixture.decisions.reduce<string[][]>(
			(acc, point) => acc.flatMap(seq => point.options.map(o => [...seq, o.id])),
			[[]]
		);
		for (const wager of [10, 33, 250]) {
			for (const options of sequences) {
				let round = await startFixture(token, fixture.fixtureId, wager);
				const expected = payoutFor(wager, fixture.multiplierBps);
				assert.deepEqual(round.outcomePolicy, {
					type: "fixed",
					outcomeId: fixture.outcomeId,
					payoutMinorUnits: expected
				});
				for (const optionId of options) round = await decide(token, round, optionId);
				const label = `${fixture.fixtureId} ${options.join(",")} wager ${wager}`;
				assert.equal(round.status, "resolved", label);
				assert.equal(round.outcome?.payoutMinorUnits, expected, label);
				assert.equal(round.outcome?.category, fixture.category, label);
				const before = (await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits;
				const settled = await api.settle(token, round.roundId);
				assert.equal(settled.json.message.balanceMinorUnits, before + expected, label);
				assert.equal(settled.json.message.round.settlement.payoutMinorUnits, expected, label);
				rounds++;
			}
		}
	}
	assert.ok(rounds >= FIXTURES.length * 3, `ran ${rounds} rounds`);
});

const CATEGORY_BPS = {
	loss: 0,
	small_win: 12_000,
	standard_win: 20_000,
	big_win: 50_000,
	major_win: 250_000,
	jackpot: 1_000_000
};

test("Policy B: force.category decides the round whatever option was chosen, and pays that category", async () => {
	const { token } = await newPlayer();
	for (const category of Object.keys(CATEGORY_BPS) as (keyof typeof CATEGORY_BPS)[]) {
		for (const optionId of ["safe_route", "risky_vault"]) {
			await api.force(token, { policy: "choice_constrained", category });
			const started = (await api.start(token, 250)).json.message.round as RoundRecord;
			assert.equal(started.outcomePolicy.type, "choice_constrained");
			const round = await decide(token, started, optionId);
			const label = `${category} via ${optionId}`;
			assert.equal(round.status, "resolved", label);
			assert.equal(round.outcome?.category, category, label);
			assert.equal(round.outcome?.payoutMinorUnits, payoutFor(250, CATEGORY_BPS[category]), label);
			await api.settle(token, round.roundId);
		}
	}
});

test("Policy B is reproducible from seed plus decisions, and the options use different tables", async () => {
	const results = new Map<string, string[]>();
	for (const seed of ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6", "seed-7", "seed-8"]) {
		for (const optionId of ["safe_route", "risky_vault"]) {
			const outcomes: string[] = [];
			for (let run = 0; run < 2; run++) {
				const { token } = await newPlayer();
				await api.call("POST", "/api/debug/seed", { token, body: { seed } });
				let round = await startFixture(token, "vault_route");
				round = await decide(token, round, optionId);
				outcomes.push(`${round.outcome!.outcomeId}:${round.outcome!.payoutMinorUnits}`);
			}
			assert.equal(outcomes[0], outcomes[1], `${seed} ${optionId}`);
			results.set(`${seed}/${optionId}`, outcomes);
		}
	}
	const safe = [...results].filter(([k]) => k.endsWith("safe_route")).map(([, v]) => v[0]);
	assert.ok(
		safe.every(o => /_(loss|small_win|standard_win):/.test(o)),
		`safe route never wins big: ${safe}`
	);
});

test("resolveDelayMs holds a Policy B round as running until the delay passes, read at the next round read", async () => {
	const { token, name } = await newPlayer();
	const state = debugRecord(`debug:${name}`);
	state.simulation.resolveDelayMs = 60_000;
	const started = await startFixture(token, "vault_route");
	const held = await decide(token, started, "risky_vault");
	assert.equal(held.status, "running");
	assert.equal(held.pendingDecision, null);
	assert.equal(held.outcome, null);
	assert.equal(held.decisions.length, 1);
	const current = (await api.call("POST", "/api/game/current", { token, body: {} })).json;
	assert.equal(current.round.status, "running");
	assert.equal((await api.settle(token, started.roundId)).json.error.code, "round_not_resolved");

	state.simulation.resolveDelayMs = 40;
	await sleep(80);
	const read = await roundOf(token, started.roundId);
	assert.equal(read.status, "resolved", "resolved lazily by the read, with no route change");
	assert.ok(read.outcome);
	assert.equal((await api.settle(token, started.roundId)).status, 200);
});

test("resolveDelayMs changed to 0 releases a held round on the next read; Policy A ignores the delay", async () => {
	const { token, name } = await newPlayer();
	const state = debugRecord(`debug:${name}`);
	state.simulation.resolveDelayMs = 60_000;
	const held = await decide(token, await startFixture(token, "vault_route"), "safe_route");
	assert.equal(held.status, "running");
	state.simulation.resolveDelayMs = 0;
	assert.equal((await roundOf(token, held.roundId)).status, "resolved");
	await api.settle(token, held.roundId);

	state.simulation.resolveDelayMs = 60_000;
	const fixed = await decide(token, await startFixture(token, "evolution_loss"), "keep");
	assert.equal(fixed.status, "resolved", "a fixed payout is already known, so there is nothing to wait for");
});

test("a held round resolves lazily on `current` too, and the statusHistory records running then resolved", async () => {
	const { token, name } = await newPlayer();
	const state = debugRecord(`debug:${name}`);
	state.simulation.resolveDelayMs = 30;
	const started = await startFixture(token, "vault_route");
	await decide(token, started, "risky_vault");
	await sleep(60);
	const current = (await api.call("POST", "/api/game/current", { token, body: {} })).json;
	assert.equal(current.round.status, "resolved");
	const debug = (await api.call("GET", `/api/debug/round/${started.roundId}`, { token })).json.debug;
	assert.deepEqual(
		debug.statusHistory.map((s: { status: string }) => s.status),
		["awaiting_choice", "running", "resolved"]
	);
});

test("GET /api/game/history: settled rounds only, newest first, with total, limit clamped to 1..50, and offset", async () => {
	const { token } = await newPlayer();
	const empty = await api.call("GET", "/api/game/history", { token });
	assert.equal(empty.status, 200);
	assert.deepEqual(empty.json, { rounds: [], total: 0 });

	await api.force(token, { fixtureId: "loss_1", sticky: true });
	const ids: string[] = [];
	for (let i = 0; i < 55; i++) {
		const started = await api.start(token, 10 + i);
		ids.push(started.json.roundId);
		await api.settle(token, started.json.roundId);
	}
	await api.force(token, { fixtureId: "small_win_1" });
	const open = await api.start(token, 100);

	const page = (query: string) => api.call("GET", `/api/game/history${query}`, { token });
	const first = await page("");
	assert.equal(first.json.total, 55, "the open round is not listed");
	assert.equal(first.json.rounds.length, 10, "default limit");
	assert.deepEqual(
		first.json.rounds.map((r: { roundId: string }) => r.roundId),
		ids.slice(-10).reverse()
	);
	assert.ok(!first.json.rounds.some((r: { roundId: string }) => r.roundId === open.json.roundId));
	assert.deepEqual(Object.keys(first.json.rounds[0]).sort(), [
		"category",
		"createdAt",
		"currency",
		"payoutMinorUnits",
		"roundId",
		"settledAt",
		"wagerMinorUnits"
	]);
	assert.deepEqual(
		{ ...first.json.rounds[0], createdAt: 0, settledAt: 0 },
		{
			roundId: ids[54],
			createdAt: 0,
			settledAt: 0,
			wagerMinorUnits: 64,
			payoutMinorUnits: 0,
			currency: "USD",
			category: "loss"
		}
	);

	assert.equal((await page("?limit=999")).json.rounds.length, 50, "clamped down to 50");
	assert.equal((await page("?limit=50")).json.rounds.length, 50);
	assert.equal((await page("?limit=0")).json.rounds.length, 1, "clamped up to 1");
	assert.equal((await page("?limit=-7")).json.rounds.length, 1);
	assert.equal((await page("?limit=abc")).json.rounds.length, 10, "unparsable falls back to the default");
	const offset = await page("?limit=5&offset=50");
	assert.deepEqual(
		offset.json.rounds.map((r: { roundId: string }) => r.roundId),
		ids.slice(0, 5).reverse()
	);
	assert.equal(offset.json.total, 55);
	assert.deepEqual((await page("?offset=55")).json.rounds, []);
	assert.equal((await page("?offset=-3&limit=2")).json.rounds[0].roundId, ids[54], "negative offset is 0");
});

test("history shows the payout of a decision round, belongs to the player, and needs a session", async () => {
	const { token } = await newPlayer();
	const round = await decide(
		token,
		await decide(token, await startFixture(token, "evolution_big", 200), "twin_daggers"),
		"evolve"
	);
	await api.settle(token, round.roundId);
	const { rounds } = (await api.call("GET", "/api/game/history", { token })).json;
	assert.equal(rounds.length, 1);
	assert.equal(rounds[0].payoutMinorUnits, 1000);
	assert.equal(rounds[0].category, "big_win");
	const stranger = await newPlayer();
	assert.deepEqual((await api.call("GET", "/api/game/history", { token: stranger.token })).json, {
		rounds: [],
		total: 0
	});
	assert.equal((await api.call("GET", "/api/game/history")).status, 401);
});
