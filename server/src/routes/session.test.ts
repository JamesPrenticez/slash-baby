// Run: pnpm test:server
// POST /api/session and POST /api/session/refresh against the real handler (contract §2, §11).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { findSession } from "../sessions.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

test("bootstrap returns a SessionResponse with the placeholder config", async () => {
	const { status, json } = await api.call("POST", "/api/session", { body: {} });
	assert.equal(status, 200);
	assert.match(json.sessionToken, /^[0-9a-f-]{36}$/);
	assert.match(json.playerId, /^anon:/);
	assert.deepEqual(Object.keys(json).sort(), ["balanceMinorUnits", "config", "playerId", "sessionToken"]);
	assert.deepEqual(json.config, {
		mock: true,
		contractVersion: "0.2",
		currency: "USD",
		minorUnitExponent: 2,
		minWagerMinorUnits: 10,
		maxWagerMinorUnits: 50000,
		defaultWagerMinorUnits: 100,
		wagerStepsMinorUnits: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000]
	});
});

test("bootstrap takes an empty body and no body at all", async () => {
	assert.equal((await api.call("POST", "/api/session")).status, 200);
	assert.equal((await api.call("POST", "/api/session", { rawBody: "" })).status, 200);
});

test("bootstrap can pick a currency, and the exponent follows it", async () => {
	const { json } = await api.call("POST", "/api/session", { body: { currency: "JPY" } });
	assert.equal(json.config.currency, "JPY");
	assert.equal(json.config.minorUnitExponent, 0);
});

test("an unknown currency is 400 invalid_currency", async () => {
	const { status, json } = await api.call("POST", "/api/session", { body: { currency: "XXX" } });
	assert.equal(status, 400);
	assert.equal(json.error.code, "invalid_currency");
});

test("a currency that is not a string is 400 invalid_request", async () => {
	for (const currency of [5, null, ["USD"], { code: "USD" }]) {
		const { status, json } = await api.call("POST", "/api/session", { body: { currency } });
		assert.equal(status, 400, JSON.stringify(currency));
		assert.equal(json.error.code, "invalid_request");
	}
});

test("a rejected bootstrap changes nothing: the next one still sees the old currency", async () => {
	await api.call("POST", "/api/session", { body: { currency: "GBP" } });
	await api.call("POST", "/api/session", { body: { currency: "XXX" } });
	const { json } = await api.call("POST", "/api/session", { body: {} });
	assert.equal(json.config.currency, "GBP");
});

test("a second session for the same player sees the same wallet", async () => {
	const first = await api.call("POST", "/api/session", { body: {} });
	assert.notEqual(findSession(first.json.sessionToken), undefined);
	findSession(first.json.sessionToken)!.player.balanceMinorUnits = 12345;
	const second = await api.call("POST", "/api/session", { body: {} });
	assert.notEqual(second.json.sessionToken, first.json.sessionToken);
	assert.equal(second.json.playerId, first.json.playerId);
	assert.equal(second.json.balanceMinorUnits, 12345);
});

test("refresh rotates the token and the old one is dead at once", async () => {
	const { json: boot } = await api.call("POST", "/api/session", { body: {} });
	const refreshed = await api.call("POST", "/api/session/refresh", { token: boot.sessionToken });
	assert.equal(refreshed.status, 200);
	assert.deepEqual(Object.keys(refreshed.json), ["sessionToken"]);
	assert.notEqual(refreshed.json.sessionToken, boot.sessionToken);

	const old = await api.call("POST", "/api/session/refresh", { token: boot.sessionToken });
	assert.equal(old.status, 401);
	assert.equal(old.json.error.code, "invalid_session");

	const again = await api.call("POST", "/api/session/refresh", { token: refreshed.json.sessionToken });
	assert.equal(again.status, 200, "the new token refreshes once in its turn");
});

test("a rotated-away token no longer opens anything else", async () => {
	const { json: boot } = await api.call("POST", "/api/session", { body: {} });
	const { json: next } = await api.call("POST", "/api/session/refresh", { token: boot.sessionToken });
	assert.equal((await api.call("GET", "/api/game/no-such-route", { token: boot.sessionToken })).status, 401);
	assert.equal((await api.call("GET", "/api/game/no-such-route", { token: next.sessionToken })).status, 404);
});

test("refresh without a valid token is 401 invalid_session", async () => {
	for (const token of [undefined, "nope"]) {
		const { status, json } = await api.call("POST", "/api/session/refresh", { token });
		assert.equal(status, 401);
		assert.equal(json.error.code, "invalid_session");
	}
});
