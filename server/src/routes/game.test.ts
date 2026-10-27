// Run: pnpm test:server
// GET /api/game/balance, POST /api/game/current, GET /api/game/round/:roundId (contract §3, §5).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { config } from "../config.ts";
import { startTestServer } from "../testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;
let count = 0;

before(async () => {
	api = await startTestServer();
});

after(() => api.close());

const newPlayer = (currency?: string) => api.newDebugSession(`game-${++count}`, currency);

test("balance is the wallet in minor units with its currency", async () => {
	const { sessionToken: token } = await newPlayer("JPY");
	const { status, json } = await api.call("GET", "/api/game/balance", { token });
	assert.equal(status, 200);
	assert.deepEqual(json, { balanceMinorUnits: config.startingBalanceMinorUnits, currency: "JPY" });
});

test("balance follows a wager and a settlement", async () => {
	const { sessionToken: token } = await newPlayer();
	await api.force(token, { fixtureId: "small_win_2" });
	const { roundId } = (await api.start(token, 1000)).json;
	assert.equal((await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits, 99_000);
	await api.settle(token, roundId);
	assert.equal((await api.call("GET", "/api/game/balance", { token })).json.balanceMinorUnits, 99_000 + 1500);
});

test("current with no round is inactive and carries no round", async () => {
	const { sessionToken: token } = await newPlayer();
	const { status, json } = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(status, 200);
	assert.deepEqual(json, { balanceMinorUnits: config.startingBalanceMinorUnits, currency: "USD", active: false });
});

test("current returns the open round in whatever status it is in, so a reload can resume it", async () => {
	const { sessionToken: token } = await newPlayer();
	const started = await api.start(token, 100);
	const current = await api.call("POST", "/api/game/current", { token, body: {} });
	assert.equal(current.status, 200);
	assert.equal(current.json.active, true);
	assert.equal(current.json.currency, "USD");
	assert.equal(current.json.balanceMinorUnits, started.json.message.balanceMinorUnits);
	assert.deepEqual(current.json.round, started.json.message.round);
	assert.equal(current.json.round.status, "resolved", "resolved but unsettled is still open");
});

test("current survives a token refresh and a new session for the same player", async () => {
	const { sessionToken, playerId } = await newPlayer();
	const { roundId } = (await api.start(sessionToken, 100)).json;
	const rotated = (await api.call("POST", "/api/session/refresh", { token: sessionToken, body: {} })).json.sessionToken;
	assert.equal((await api.call("POST", "/api/game/current", { token: rotated, body: {} })).json.round.roundId, roundId);
	const again = await api.call("POST", "/api/debug/session", { body: { playerId: playerId.replace("debug:", "") } });
	const current = await api.call("POST", "/api/game/current", { token: again.json.sessionToken, body: {} });
	assert.equal(current.json.round.roundId, roundId);
});

test("current is inactive again once the round is settled, and it never changes state", async () => {
	const { sessionToken: token } = await newPlayer();
	const { roundId } = (await api.start(token, 100)).json;
	const before = await api.call("POST", "/api/game/current", { token, body: {} });
	await api.call("POST", "/api/game/current", { token, body: {} });
	assert.deepEqual((await api.call("POST", "/api/game/current", { token, body: {} })).json, before.json);
	await api.settle(token, roundId);
	assert.equal((await api.call("POST", "/api/game/current", { token, body: {} })).json.active, false);
});

test("round/:roundId returns the player's round in any status", async () => {
	const { sessionToken: token } = await newPlayer();
	const started = await api.start(token, 100);
	const { roundId } = started.json;
	const open = await api.call("GET", `/api/game/round/${roundId}`, { token });
	assert.equal(open.status, 200);
	assert.deepEqual(open.json, { round: started.json.message.round });

	const settled = await api.settle(token, roundId);
	const closed = await api.call("GET", `/api/game/round/${roundId}`, { token });
	assert.deepEqual(closed.json, { round: settled.json.message.round });
	assert.equal(closed.json.round.status, "settled");
});

test("round/:roundId is 404 round_not_found for a missing round and for another player's", async () => {
	const owner = await newPlayer();
	const other = await newPlayer();
	const { roundId } = (await api.start(owner.sessionToken, 100)).json;
	for (const id of ["no-such-round", roundId, "a%2Fb"]) {
		const { status, json } = await api.call("GET", `/api/game/round/${id}`, { token: other.sessionToken });
		assert.equal(status, 404, id);
		assert.equal(json.error.code, "round_not_found");
	}
});

test("every game read needs a valid bearer token", async () => {
	for (const [method, path] of [
		["GET", "/api/game/balance"],
		["POST", "/api/game/current"],
		["GET", "/api/game/round/x"]
	]) {
		for (const token of [undefined, "nope"]) {
			const { status, json } = await api.call(method, path, { token, body: method === "POST" ? {} : undefined });
			assert.equal(status, 401, `${method} ${path}`);
			assert.equal(json.error.code, "invalid_session");
		}
	}
});

test("a currency switch while a round is open is 409 round_already_started and changes nothing", async () => {
	const { sessionToken: token, playerId } = await newPlayer();
	const id = playerId.replace("debug:", "");
	await api.force(token, { category: "loss" });
	const { roundId } = (await api.start(token, 100)).json;

	const refused = await api.call("POST", "/api/debug/session", { body: { playerId: id, currency: "JPY" } });
	assert.equal(refused.status, 409);
	assert.equal(refused.json.error.code, "round_already_started");
	const anon = await api.call("POST", "/api/session", { body: { currency: "JPY" } });
	assert.equal(anon.status, 200, "another player is not affected");

	const balance = await api.call("GET", "/api/game/balance", { token });
	assert.deepEqual(balance.json, { balanceMinorUnits: config.startingBalanceMinorUnits - 100, currency: "USD" });
	assert.equal((await api.call("GET", "/api/game/round/" + roundId, { token })).json.round.currency, "USD");

	// The same currency is not a switch: a reload with an open round can bootstrap again.
	const same = await api.call("POST", "/api/debug/session", { body: { playerId: id, currency: "USD" } });
	assert.equal(same.status, 200);
	const bare = await api.call("POST", "/api/debug/session", { body: { playerId: id } });
	assert.equal(bare.status, 200);

	await api.settle(token, roundId);
	const switched = await api.call("POST", "/api/debug/session", { body: { playerId: id, currency: "JPY" } });
	assert.equal(switched.status, 200, "allowed once the round is settled");
	assert.equal(switched.json.config.currency, "JPY");
	assert.equal(switched.json.balanceMinorUnits, config.startingBalanceMinorUnits - 100, "relabel only, no conversion");
	assert.equal((await api.call("GET", "/api/game/balance", { token })).json.currency, "JPY");
});
