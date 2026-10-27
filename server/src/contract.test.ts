// Run: pnpm test:server
// Contract conformance (docs/API-CONTRACT.md §3, §8): every endpoint answers with the contract's status, shape and error
// code, against the real handler on an ephemeral port. Money fields are checked to be integers everywhere.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { type Reply, startTestServer } from "./testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;
const KEY = "0123456789abcdef0123";

before(async () => {
	api = await startTestServer();
});
after(() => api.close());

const player = async () => (await api.newDebugSession(`contract-${++count}`)).sessionToken;

/** Walks a JSON value: every `*MinorUnits` is a safe integer and no number anywhere is a float. */
function assertIntegerMoney(value: unknown, path = "$"): void {
	if (typeof value === "number") assert.ok(Number.isInteger(value) || path.endsWith("uptime"), `${path} is ${value}`);
	else if (Array.isArray(value)) value.forEach((v, i) => assertIntegerMoney(v, `${path}[${i}]`));
	else if (value && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) {
			if (k.endsWith("MinorUnits")) assert.ok([v].flat().every(Number.isSafeInteger), `${path}.${k} is ${v}`);
			assertIntegerMoney(v, `${path}.${k}`);
		}
	}
}

const expectError = (reply: Pick<Reply, "status" | "json">, status: number, code: string, label = code) => {
	assert.equal(reply.status, status, `${label}: status`);
	assert.equal(reply.json.error.code, code, `${label}: code`);
	assert.equal(typeof reply.json.error.message, "string", `${label}: message`);
};

test("GET /api/health: 200, mock labelled, no auth", async () => {
	const { status, json } = await api.call("GET", "/api/health");
	assert.equal(status, 200);
	assert.equal(json.status, "ok");
	assert.equal(json.mock, true);
	assert.equal(json.contractVersion, "0.2");
});

test("POST /api/session and /api/session/refresh: 200 shapes, 400 invalid_currency, 401 invalid_session", async () => {
	const created = await api.call("POST", "/api/session", { body: {} });
	assert.equal(created.status, 200);
	assert.deepEqual(Object.keys(created.json).sort(), ["balanceMinorUnits", "config", "playerId", "sessionToken"]);
	assertIntegerMoney(created.json);

	expectError(await api.call("POST", "/api/session", { body: { currency: "XXX" } }), 400, "invalid_currency");

	const refreshed = await api.call("POST", "/api/session/refresh", { token: created.json.sessionToken, body: {} });
	assert.equal(refreshed.status, 200);
	assert.deepEqual(Object.keys(refreshed.json), ["sessionToken"]);
	expectError(
		await api.call("POST", "/api/session/refresh", { token: created.json.sessionToken, body: {} }),
		401,
		"invalid_session",
		"rotated token"
	);
	expectError(await api.call("POST", "/api/session/refresh", { body: {} }), 401, "invalid_session", "no token");
});

test("GET /api/game/balance, POST /api/game/current, GET /api/game/history: 200 shapes, 401 without a token", async () => {
	const token = await player();
	const balance = await api.call("GET", "/api/game/balance", { token });
	assert.equal(balance.status, 200);
	assert.deepEqual(Object.keys(balance.json).sort(), ["balanceMinorUnits", "currency"]);

	const idle = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(idle.status, 200);
	assert.equal(idle.json.active, false);
	assert.equal("round" in idle.json, false);

	const history = await api.call("GET", "/api/game/history", { token });
	assert.equal(history.status, 200);
	assert.deepEqual(history.json, { rounds: [], total: 0 });

	for (const [method, path] of [
		["GET", "/api/game/balance"],
		["POST", "/api/game/current"],
		["POST", "/api/game/play"],
		["GET", "/api/game/round/x"],
		["GET", "/api/game/history"]
	]) {
		expectError(
			await api.call(method, path, { body: method === "POST" ? {} : undefined }),
			401,
			"invalid_session",
			path
		);
	}
});

test("POST /api/game/play start: 200 shape, then 400 invalid_bet, 402 insufficient_balance, 409 round_already_started", async () => {
	const token = await player();
	expectError(await api.start(token, 1.5), 400, "invalid_bet");

	const ok = await api.start(token, 100);
	assert.equal(ok.status, 200);
	assertIntegerMoney(ok.json);
	expectError(await api.start(token, 100), 409, "round_already_started");

	const poor = await player();
	await api.call("POST", "/api/debug/balance/set", { token: poor, body: { balanceMinorUnits: 10 } });
	expectError(await api.start(poor, 100), 402, "insufficient_balance");
});

test("POST /api/game/play envelope: invalid_json, invalid_request, invalid_message are 400", async () => {
	const token = await player();
	expectError(await api.call("POST", "/api/game/play", { token, rawBody: "{nope" }), 400, "invalid_json");
	expectError(await api.call("POST", "/api/game/play", { token, rawBody: "[]" }), 400, "invalid_request", "array body");
	for (const idempotencyKey of [undefined, "", "short", "x".repeat(65), "k".repeat(20).length]) {
		expectError(
			await api.call("POST", "/api/game/play", {
				token,
				body: { idempotencyKey, message: { start: { wagerMinorUnits: 100 } } }
			}),
			400,
			"invalid_request",
			`key ${String(idempotencyKey)}`
		);
	}
	for (const message of [
		undefined,
		{},
		"start",
		{ bogus: {} },
		{ start: { wagerMinorUnits: 100 }, settle: { roundId: "x" } }
	]) {
		expectError(
			await api.call("POST", "/api/game/play", { token, body: { idempotencyKey: KEY, message } }),
			400,
			"invalid_message",
			JSON.stringify(message)
		);
	}
	expectError(
		await api.call("POST", "/api/game/play", {
			token,
			body: {
				idempotencyKey: KEY,
				message: { decide: { roundId: "r", decisionId: 1, optionId: "o", sequenceNumber: 1 } }
			}
		}),
		400,
		"invalid_request",
		"decide field types"
	);
});

test("POST /api/game/play decide: 200, and 404 / 409 / 409 / 409 / 400 for each refusal", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "evolution_big" });
	const started = (await api.start(token, 100)).json.message.round;
	assert.equal(started.status, "awaiting_choice");
	const roundId = started.roundId;
	const decide = (over: Record<string, unknown>, key?: string) =>
		api.play(
			token,
			{
				decide: { roundId, decisionId: "weapon_choice", optionId: "twin_daggers", sequenceNumber: 1, ...over }
			} as never,
			key
		);

	expectError(await decide({ roundId: "00000000-0000-4000-8000-000000000000" }), 404, "round_not_found");
	expectError(await decide({ decisionId: "weapon_evolution" }), 409, "stale_decision", "wrong decision");
	expectError(await decide({ sequenceNumber: 2 }), 409, "stale_decision", "wrong sequence");
	expectError(await decide({ optionId: "nope" }), 400, "invalid_option");

	const first = await decide({});
	assert.equal(first.status, 200);
	assert.equal(first.json.message.round.pendingDecision.id, "weapon_evolution");
	expectError(await decide({ optionId: "shadow_blades" }), 409, "decision_already_recorded");

	const last = await api.play(token, {
		decide: { roundId, decisionId: "weapon_evolution", optionId: "keep", sequenceNumber: 2 }
	});
	assert.equal(last.status, 200);
	assert.equal(last.json.message.round.status, "resolved");
	expectError(
		await api.play(token, { decide: { roundId, decisionId: "weapon_evolution", optionId: "keep", sequenceNumber: 3 } }),
		409,
		"round_not_awaiting_choice"
	);
});

test("POST /api/game/play settle: 200, 404 round_not_found, 409 round_not_resolved, 409 idempotency_key_reused", async () => {
	const token = await player();
	await api.force(token, { fixtureId: "dagger_choice_small" });
	const { roundId } = (await api.start(token, 100, KEY)).json;

	expectError(await api.settle(token, roundId), 409, "round_not_resolved");
	expectError(await api.settle(token, "00000000-0000-4000-8000-000000000000"), 404, "round_not_found");
	expectError(await api.start(token, 200, KEY), 409, "idempotency_key_reused");

	await api.play(token, {
		decide: { roundId, decisionId: "weapon_choice", optionId: "twin_daggers", sequenceNumber: 1 }
	});
	const settled = await api.settle(token, roundId);
	assert.equal(settled.status, 200);
	assert.equal(settled.json.message.round.status, "settled");
	assertIntegerMoney(settled.json);
});

test("GET /api/game/round/:roundId and POST /api/game/current return the record; history lists settled rounds", async () => {
	const token = await player();
	const { roundId } = (await api.start(token, 100)).json;

	const read = await api.call("GET", `/api/game/round/${roundId}`, { token });
	assert.equal(read.status, 200);
	assert.deepEqual(Object.keys(read.json), ["round"]);
	const current = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(current.json.active, true);
	assert.deepEqual(current.json.round, read.json.round);
	expectError(await api.call("GET", "/api/game/round/nope", { token }), 404, "round_not_found");

	await api.settle(token, roundId);
	const history = await api.call("GET", "/api/game/history?limit=5", { token });
	assert.equal(history.status, 200);
	assert.equal(history.json.total, 1);
	assert.equal(history.json.rounds[0].roundId, roundId);
	assertIntegerMoney(history.json);
});

test("routes that do not exist are 404 not_found; OPTIONS is 204 with CORS", async () => {
	const token = await player();
	expectError(await api.call("GET", "/api/nope", { token }), 404, "not_found");
	expectError(await api.call("GET", "/api/game/play", { token }), 404, "not_found", "wrong method");
	const options = await api.call("OPTIONS", "/api/game/play");
	assert.equal(options.status, 204);
	assert.equal(options.headers.get("access-control-allow-origin"), "*");
});

test("debug routes: 200 with a token, 401 without, 400 invalid_debug_request for bad bodies, 404 for an unknown round", async () => {
	const token = await player();
	const gets = ["/api/debug/state"];
	const posts: [string, unknown][] = [
		["/api/debug/balance/set", { balanceMinorUnits: 500 }],
		["/api/debug/balance/credit", { amountMinorUnits: 5 }],
		["/api/debug/force", { fixtureId: "loss_1", sticky: false }],
		["/api/debug/simulate", { latencyMs: 0 }],
		["/api/debug/seed", { seed: "contract" }],
		["/api/debug/reset", {}]
	];
	for (const path of gets) {
		assert.equal((await api.call("GET", path, { token })).status, 200, path);
		expectError(await api.call("GET", path), 401, "invalid_session", path);
	}
	for (const [path, body] of posts) {
		const ok = await api.call("POST", path, { token, body });
		assert.equal(ok.status, 200, path);
		assertIntegerMoney(ok.json);
		expectError(await api.call("POST", path, { body }), 401, "invalid_session", path);
	}

	expectError(
		await api.call("POST", "/api/debug/balance/set", { token, body: { balanceMinorUnits: 1.5 } }),
		400,
		"invalid_debug_request"
	);
	expectError(
		await api.call("POST", "/api/debug/force", { token, body: { category: "nope" } }),
		400,
		"invalid_debug_request"
	);
	expectError(
		await api.call("POST", "/api/debug/simulate", { token, body: { errorRate: 2 } }),
		400,
		"invalid_debug_request"
	);
	expectError(await api.call("POST", "/api/debug/seed", { token, body: { seed: "" } }), 400, "invalid_debug_request");
	expectError(
		await api.call("POST", "/api/debug/session", { body: { playerId: "bad id!" } }),
		400,
		"invalid_debug_request"
	);
	expectError(await api.call("GET", "/api/debug/round/nope", { token }), 404, "round_not_found");

	const expire = await api.call("POST", "/api/debug/expire-session", { token, body: {} });
	assert.deepEqual(expire.json, { ok: true });
	expectError(await api.call("GET", "/api/game/balance", { token }), 401, "invalid_session", "expired token");
});

test("simulated failures use code simulated_error at the requested status and apply nothing", async () => {
	const token = await player();
	await api.call("POST", "/api/debug/simulate", {
		token,
		body: { failNext: { count: 1, status: 503, verb: "start" } }
	});
	const failed = await api.start(token, 100);
	expectError(failed, 503, "simulated_error");
	assert.equal((await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits, 100000);
});
