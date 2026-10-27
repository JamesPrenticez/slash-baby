// Run: pnpm test:server
// /api/debug/session, /state and /expire-session, and the debug-off switch (contract §2, §10).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { config } from "../config.ts";
import { fixtureInfo, FIXTURES } from "../fixtures.ts";
import { findSession } from "../sessions.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

test("debug/session mints a session for debug:<playerId>, no token needed", async () => {
	const { status, json } = await api.call("POST", "/api/debug/session", { body: { playerId: "tester-ab12cd34" } });
	assert.equal(status, 200);
	assert.equal(json.playerId, "debug:tester-ab12cd34");
	assert.equal(json.balanceMinorUnits, config.startingBalanceMinorUnits);
	assert.equal(json.config.mock, true);
	assert.equal(json.config.currency, "USD");
});

test("debug/session honours currency, rejects an unknown one", async () => {
	const { json } = await api.call("POST", "/api/debug/session", { body: { playerId: "dbg-eur", currency: "EUR" } });
	assert.equal(json.config.currency, "EUR");
	const bad = await api.call("POST", "/api/debug/session", { body: { playerId: "dbg-eur", currency: "XXX" } });
	assert.equal(bad.status, 400);
	assert.equal(bad.json.error.code, "invalid_currency");
	const notString = await api.call("POST", "/api/debug/session", { body: { playerId: "dbg-eur", currency: 5 } });
	assert.equal(notString.json.error.code, "invalid_debug_request");
});

test("debug/session validates playerId as 1 to 64 of [A-Za-z0-9_-]", async () => {
	for (const playerId of [undefined, 5, "", "a b", "a/b", "ünï", "x".repeat(65)]) {
		const { status, json } = await api.call("POST", "/api/debug/session", { body: { playerId } });
		assert.equal(status, 400, String(playerId));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	const edge = await api.call("POST", "/api/debug/session", { body: { playerId: "x".repeat(64) } });
	assert.equal(edge.status, 200);
	const notObject = await api.call("POST", "/api/debug/session", { rawBody: "[]" });
	assert.equal(notObject.json.error.code, "invalid_debug_request");
});

test("the same debug player gets the same wallet, another player gets a fresh one", async () => {
	const a1 = await api.newDebugSession("wallet-a");
	findSession(a1.sessionToken)!.player.balanceMinorUnits = 5;
	const a2 = await api.newDebugSession("wallet-a");
	const b = await api.newDebugSession("wallet-b");
	assert.equal(a2.balanceMinorUnits, 5);
	assert.equal(b.balanceMinorUnits, config.startingBalanceMinorUnits);
});

test("a debug player and an anon player never share an id", async () => {
	const anon = await api.call("POST", "/api/session", { body: {} });
	const dbg = await api.newDebugSession("anon:127.0.0.1");
	assert.notEqual(dbg.playerId, anon.json.playerId);
});

test("debug/state is the DebugState for the calling player, fixtures and currencies included", async () => {
	const { sessionToken } = await api.newDebugSession("state-player");
	const { status, json } = await api.call("GET", "/api/debug/state", { token: sessionToken });
	assert.equal(status, 200);
	assert.deepEqual(json, {
		mock: true,
		contractVersion: "0.2",
		playerId: "debug:state-player",
		seed: config.defaultSeed,
		roundsPlayed: 0,
		force: null,
		simulation: { latencyMs: 0, errorRate: 0, failNext: null, dropAfterAccept: 0, resolveDelayMs: 0 },
		fixtures: FIXTURES.map(fixtureInfo),
		currencies: [
			{ code: "USD", minorUnitExponent: 2 },
			{ code: "EUR", minorUnitExponent: 2 },
			{ code: "GBP", minorUnitExponent: 2 },
			{ code: "JPY", minorUnitExponent: 0 }
		]
	});
	assert.ok(json.fixtures.length >= 12, "at least two fixtures for each of the six categories");
});

test("debug/state is per player: another player does not see this player's counter", async () => {
	const a = await api.newDebugSession("state-a");
	const b = await api.newDebugSession("state-b");
	await api.start(a.sessionToken, 100);
	assert.equal((await api.call("GET", "/api/debug/state", { token: a.sessionToken })).json.roundsPlayed, 1);
	assert.equal((await api.call("GET", "/api/debug/state", { token: b.sessionToken })).json.roundsPlayed, 0);
});

test("balance/set sets the exact balance and returns it with the currency", async () => {
	const { sessionToken: token } = await api.newDebugSession("bal-set", "JPY");
	for (const balanceMinorUnits of [0, 12_345, Number.MAX_SAFE_INTEGER]) {
		const { status, json } = await api.call("POST", "/api/debug/balance/set", { token, body: { balanceMinorUnits } });
		assert.equal(status, 200);
		assert.deepEqual(json, { balanceMinorUnits, currency: "JPY" });
		assert.equal((await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits, balanceMinorUnits);
	}
});

test("balance/set rejects anything that is not a non-negative safe integer", async () => {
	const { sessionToken: token } = await api.newDebugSession("bal-set-bad");
	for (const balanceMinorUnits of [undefined, null, "5", 1.5, -1, 2 ** 60, NaN]) {
		const { status, json } = await api.call("POST", "/api/debug/balance/set", { token, body: { balanceMinorUnits } });
		assert.equal(status, 400, String(balanceMinorUnits));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	const notObject = await api.call("POST", "/api/debug/balance/set", { token, rawBody: "[]" });
	assert.equal(notObject.json.error.code, "invalid_debug_request");
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits
	);
});

test("balance/credit adds the amount, 100000 by default", async () => {
	const { sessionToken: token } = await api.newDebugSession("bal-credit");
	const first = await api.call("POST", "/api/debug/balance/credit", { token, body: { amountMinorUnits: 2500 } });
	assert.deepEqual(first.json, { balanceMinorUnits: config.startingBalanceMinorUnits + 2500, currency: "USD" });
	const second = await api.call("POST", "/api/debug/balance/credit", { token, body: {} });
	assert.equal(second.json.balanceMinorUnits, config.startingBalanceMinorUnits + 2500 + 100_000);
	const noBody = await api.call("POST", "/api/debug/balance/credit", { token });
	assert.equal(noBody.json.balanceMinorUnits, config.startingBalanceMinorUnits + 2500 + 200_000);
});

test("balance/credit rejects a bad amount, and a credit that would overflow, and changes nothing", async () => {
	const { sessionToken: token } = await api.newDebugSession("bal-credit-bad");
	for (const amountMinorUnits of [null, "5", 1.5, -1, 2 ** 60]) {
		const { status, json } = await api.call("POST", "/api/debug/balance/credit", { token, body: { amountMinorUnits } });
		assert.equal(status, 400, String(amountMinorUnits));
		assert.equal(json.error.code, "invalid_debug_request");
	}
	const overflow = await api.call("POST", "/api/debug/balance/credit", {
		token,
		body: { amountMinorUnits: Number.MAX_SAFE_INTEGER }
	});
	assert.equal(overflow.status, 400);
	assert.equal(overflow.json.error.code, "invalid_debug_request");
	assert.equal(
		(await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits,
		config.startingBalanceMinorUnits
	);
});

test("every debug route except debug/session needs a valid token", async () => {
	for (const [method, path] of [
		["GET", "/api/debug/state"],
		["POST", "/api/debug/expire-session"],
		["POST", "/api/debug/balance/set"],
		["POST", "/api/debug/balance/credit"],
		["POST", "/api/debug/force"],
		["POST", "/api/debug/seed"],
		["POST", "/api/debug/reset"],
		["GET", "/api/debug/round/x"],
		["POST", "/api/debug/no-such-route"]
	]) {
		for (const token of [undefined, "nope"]) {
			const { status, json } = await api.call(method, path, { token });
			assert.equal(status, 401, `${method} ${path}`);
			assert.equal(json.error.code, "invalid_session");
		}
	}
});

test("debug/expire-session kills the calling token, and only that one", async () => {
	const { sessionToken: doomed } = await api.newDebugSession("expire-me");
	const { sessionToken: sibling } = await api.newDebugSession("expire-me");

	const expired = await api.call("POST", "/api/debug/expire-session", { token: doomed });
	assert.equal(expired.status, 200);
	assert.deepEqual(expired.json, { ok: true });

	const next = await api.call("GET", "/api/debug/state", { token: doomed });
	assert.equal(next.status, 401);
	assert.equal(next.json.error.code, "invalid_session");
	assert.equal((await api.call("POST", "/api/session/refresh", { token: doomed })).status, 401);
	assert.equal((await api.call("GET", "/api/debug/state", { token: sibling })).status, 200);
});

test("with debug routes off, every /api/debug path is 404 not_found, token or not", async () => {
	const { sessionToken } = await api.newDebugSession("debug-off");
	config.debugRoutes = false;
	try {
		for (const token of [undefined, sessionToken]) {
			for (const [method, path] of [
				["POST", "/api/debug/session"],
				["GET", "/api/debug/state"],
				["POST", "/api/debug/expire-session"],
				["POST", "/api/debug/balance/set"],
				["POST", "/api/debug/balance/credit"],
				["POST", "/api/debug/force"],
				["POST", "/api/debug/seed"],
				["POST", "/api/debug/reset"],
				["GET", "/api/debug/round/x"],
				["GET", "/api/debug/no-such-route"],
				["GET", "//api/%64ebug/state"]
			]) {
				const { status, json } = await api.call(method, path, { token, body: method === "POST" ? {} : undefined });
				assert.equal(status, 404, `${method} ${path}`);
				assert.equal(json.error.code, "not_found");
			}
		}
		assert.equal(
			(await api.call("POST", "/api/session", { body: {} })).status,
			200,
			"the real session route is unaffected"
		);
		assert.equal((await api.call("GET", "/api/health")).status, 200);
	} finally {
		config.debugRoutes = true;
	}
	assert.equal((await api.call("GET", "/api/debug/state", { token: sessionToken })).status, 200, "and back on");
});
