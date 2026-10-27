// Run: pnpm test:server
// POST /api/debug/simulate and the injections it drives in http.ts (contract §10, BUILD-PLAN §9.4, §13 #9).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { config } from "../config.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

const newPlayer = async () => (await api.newDebugSession(`sim-${++count}`)).sessionToken;
const simulate = (token: string, body: unknown) => api.call("POST", "/api/debug/simulate", { token, body });
const balanceOf = async (token: string) =>
	(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits;
const stateOf = async (token: string) => (await api.call("GET", "/api/debug/state", { token })).json;

test("simulate merges only the provided fields and returns DebugState", async () => {
	const token = await newPlayer();
	const a = await simulate(token, { latencyMs: 5, dropAfterAccept: 2 });
	assert.equal(a.status, 200);
	assert.deepEqual(a.json.simulation, {
		latencyMs: 5,
		errorRate: 0,
		failNext: null,
		dropAfterAccept: 2,
		resolveDelayMs: 0
	});
	const b = await simulate(token, {
		errorRate: 0.25,
		failNext: { count: 2, status: 503, verb: "start" },
		resolveDelayMs: 9
	});
	assert.deepEqual(b.json.simulation, {
		latencyMs: 5,
		errorRate: 0.25,
		failNext: { count: 2, status: 503, verb: "start" },
		dropAfterAccept: 2,
		resolveDelayMs: 9
	});
	assert.equal((await simulate(token, {})).status, 200);
	assert.deepEqual((await stateOf(token)).simulation, b.json.simulation);
	assert.equal((await simulate(token, { failNext: null })).json.simulation.failNext, null);
});

test("simulate rejects bad fields with invalid_debug_request and applies none of them", async () => {
	const token = await newPlayer();
	const bads: unknown[] = [
		{ latencyMs: -1 },
		{ latencyMs: 1.5 },
		{ latencyMs: "5" },
		{ resolveDelayMs: 2 ** 40 },
		{ errorRate: 1.1 },
		{ errorRate: -0.1 },
		{ errorRate: "0.5" },
		{ dropAfterAccept: -1 },
		{ failNext: { count: 0, status: 500 } },
		{ failNext: { count: 1, status: 200 } },
		{ failNext: { count: 1, status: 600 } },
		{ failNext: { count: 1, status: 500, verb: "nope" } },
		{ failNext: [] },
		{ latencyMs: 7, errorRate: 2 },
		[]
	];
	for (const body of bads) {
		const { status, json } = await simulate(token, body);
		assert.equal(status, 400, JSON.stringify(body));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	assert.equal((await stateOf(token)).simulation.latencyMs, 0);
});

test("failNext fails the next N matching requests before processing, then stops", async () => {
	const token = await newPlayer();
	await simulate(token, { failNext: { count: 2, status: 503 } });
	for (let i = 0; i < 2; i++) {
		const r = await api.start(token, 100);
		assert.equal(r.status, 503);
		assert.equal(r.json.error.code, "simulated_error");
	}
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits);
	assert.equal((await stateOf(token)).roundsPlayed, 0);
	assert.equal((await api.start(token, 100)).status, 200);
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits - 100);
});

test("failNext with a verb ignores other verbs and other routes", async () => {
	const token = await newPlayer();
	await simulate(token, { failNext: { count: 1, status: 502, verb: "settle" } });
	const started = await api.start(token, 100);
	assert.equal(started.status, 200);
	assert.equal((await api.call("GET", "/api/game/balance", { token })).status, 200);
	const settled = await api.settle(token, started.json.roundId);
	assert.equal(settled.status, 502);
	assert.equal(settled.json.error.code, "simulated_error");
	const round = await api.call("GET", `/api/game/round/${started.json.roundId}`, { token });
	assert.equal(round.json.round.settlement, null);
	assert.equal((await api.settle(token, started.json.roundId)).status, 200);
});

test("errorRate 1 fails every game request with a 500 and nothing is applied", async () => {
	const token = await newPlayer();
	await simulate(token, { errorRate: 1 });
	const r = await api.start(token, 100);
	assert.equal(r.status, 500);
	assert.equal(r.json.error.code, "simulated_error");
	assert.equal((await api.call("GET", "/api/game/balance", { token })).status, 500);
});

test("debug routes are exempt from injection, so a stuck player can always undo it", async () => {
	const token = await newPlayer();
	await simulate(token, { errorRate: 1, failNext: { count: 5, status: 503 }, latencyMs: 2_000 });
	const began = Date.now();
	assert.equal((await api.call("GET", "/api/debug/state", { token })).status, 200);
	assert.equal((await api.call("POST", "/api/debug/balance/credit", { token, body: {} })).status, 200);
	assert.ok(Date.now() - began < 1_500);
	assert.equal((await stateOf(token)).simulation.failNext?.count, 5);
	const reset = await api.call("POST", "/api/debug/reset", { token });
	assert.equal(reset.json.simulation.errorRate, 0);
	assert.equal((await api.start(token, 100)).status, 200);
});

test("latencyMs delays game requests only", async () => {
	const token = await newPlayer();
	await simulate(token, { latencyMs: 150 });
	let began = Date.now();
	await api.call("GET", "/api/game/balance", { token });
	assert.ok(Date.now() - began >= 140);
	began = Date.now();
	await stateOf(token);
	assert.ok(Date.now() - began < 140);
});

test("errorRate draws from a separate stream: the fixture sequence for a seed is the same with it on or off", async () => {
	const run = async (errorRate: number) => {
		const token = await newPlayer();
		await api.call("POST", "/api/debug/seed", { token, body: { seed: "sim-stream" } });
		await api.force(token, { policy: "fixed", sticky: true });
		await simulate(token, { errorRate });
		/** Retries one action under one key until it is accepted, the way the client reconciles a 500. */
		const accepted = async (send: (key: string) => ReturnType<typeof api.start>, key: string) => {
			for (let tries = 0; tries < 200; tries++) {
				const r = await send(key);
				if (r.status === 200) return r;
				assert.equal(r.status, 500);
			}
			throw new Error("never accepted");
		};
		const ids: string[] = [];
		for (let i = 0; i < 12; i++) {
			const r = await accepted(k => api.start(token, 10, k), `start-${count}-${i}-${"x".repeat(16)}`);
			ids.push(r.json.message.round.outcome.outcomeId);
			await accepted(k => api.settle(token, r.json.roundId, k), `settle-${count}-${i}-${"x".repeat(16)}`);
		}
		return ids;
	};
	assert.deepEqual(await run(0.5), await run(0));
});

test("dropAfterAccept: the wager is debited and the round exists, and a replay of the key returns it once, replayed", async () => {
	const token = await newPlayer();
	await simulate(token, { dropAfterAccept: 1 });
	const key = randomUUID();
	// A real socket drop: fetch rejects, it does not get a status.
	await assert.rejects(api.start(token, 100, key));
	assert.equal((await stateOf(token)).simulation.dropAfterAccept, 0);
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits - 100);
	const current = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(current.status, 200);
	const roundId = current.json.round.roundId;
	assert.ok(roundId);

	const replay = await api.start(token, 100, key);
	assert.equal(replay.status, 200);
	assert.equal(replay.json.message.replayed, true);
	assert.equal(replay.json.message.round.roundId, roundId);
	assert.equal(replay.json.roundId, roundId);
	assert.equal(await balanceOf(token), config.startingBalanceMinorUnits - 100);
	assert.equal((await stateOf(token)).roundsPlayed, 1);
});

test("dropAfterAccept counts down per play call and only play calls are dropped", async () => {
	const token = await newPlayer();
	await simulate(token, { dropAfterAccept: 2 });
	assert.equal((await api.call("GET", "/api/game/balance", { token })).status, 200);
	await assert.rejects(api.start(token, 10, randomUUID()));
	const open = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(open.json.active, true);
	await assert.rejects(api.settle(token, open.json.round.roundId, randomUUID()));
	assert.equal((await stateOf(token)).simulation.dropAfterAccept, 0);
	assert.equal((await api.settle(token, open.json.round.roundId)).status, 200);
});

test("a rejected play is not an accept: dropAfterAccept stays armed", async () => {
	const token = await newPlayer();
	await simulate(token, { dropAfterAccept: 1 });
	const r = await api.start(token, 1);
	assert.equal(r.status, 400);
	assert.equal((await stateOf(token)).simulation.dropAfterAccept, 1);
});

test("reset clears the simulation", async () => {
	const token = await newPlayer();
	await simulate(token, { latencyMs: 10, failNext: { count: 1, status: 500 }, dropAfterAccept: 3 });
	const { json } = await api.call("POST", "/api/debug/reset", { token });
	assert.deepEqual(json.simulation, {
		latencyMs: 0,
		errorRate: 0,
		failNext: null,
		dropAfterAccept: 0,
		resolveDelayMs: 0
	});
});

test("simulation is per player", async () => {
	const a = await newPlayer();
	const b = await newPlayer();
	await simulate(a, { failNext: { count: 1, status: 503 } });
	assert.equal((await api.start(b, 100)).status, 200);
	assert.equal((await api.start(a, 100)).status, 503);
});

test("simulate needs a token", async () => {
	assert.equal((await api.call("POST", "/api/debug/simulate", { body: {} })).status, 401);
});

test("balance/credit at the safe-integer ceiling is refused, not clamped or wrapped", async () => {
	const token = await newPlayer();
	await api.call("POST", "/api/debug/balance/set", { token, body: { balanceMinorUnits: Number.MAX_SAFE_INTEGER } });
	const credit = await api.call("POST", "/api/debug/balance/credit", { token, body: { amountMinorUnits: 1 } });
	assert.equal(credit.status, 400);
	assert.equal(credit.json.error.code, "invalid_debug_request");
	assert.equal(await balanceOf(token), Number.MAX_SAFE_INTEGER);
	const set = await api.call("POST", "/api/debug/balance/set", {
		token,
		body: { balanceMinorUnits: Number.MAX_SAFE_INTEGER + 1 }
	});
	assert.equal(set.status, 400);
	assert.equal(await balanceOf(token), Number.MAX_SAFE_INTEGER);
});
