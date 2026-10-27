// Run: pnpm test:server

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { config } from "./config.ts";
import { HttpError } from "./http.ts";
import { createSession, expireSession, findCurrency, findSession, rotateToken, setOpenRoundGuard } from "./sessions.ts";

const eur = findCurrency("EUR")!;

test("a new player gets the starting balance and the default currency", () => {
	const { player } = createSession("unit-new");
	assert.equal(player.balanceMinorUnits, config.startingBalanceMinorUnits);
	assert.equal(player.currency.code, config.defaultCurrency);
});

test("two sessions for one player share the wallet", () => {
	const first = createSession("unit-shared");
	first.player.balanceMinorUnits = 42;
	const second = createSession("unit-shared");
	assert.notEqual(second.token, first.token);
	assert.equal(second.player.balanceMinorUnits, 42);
});

test("a currency switch relabels the wallet and keeps the balance", () => {
	createSession("unit-switch").player.balanceMinorUnits = 777;
	const { player } = createSession("unit-switch", eur);
	assert.equal(player.currency.code, "EUR");
	assert.equal(player.balanceMinorUnits, 777);
	assert.equal(createSession("unit-switch").player.currency.code, "EUR", "no currency given keeps the current one");
});

test("the open-round guard runs only on a real currency switch, and a refusal changes nothing", () => {
	const asked: string[] = [];
	setOpenRoundGuard(playerId => {
		asked.push(playerId);
		throw new HttpError(409, "round_already_started", "round open");
	});
	try {
		createSession("unit-guard"); // new player, no currency given
		createSession("unit-guard", findCurrency("USD")); // the same currency is not a switch
		assert.deepEqual(asked, []);

		assert.throws(() => createSession("unit-guard", eur), { status: 409, code: "round_already_started" });
		assert.deepEqual(asked, ["unit-guard"]);
		assert.equal(createSession("unit-guard").player.currency.code, "USD", "the refused switch relabelled nothing");
	} finally {
		setOpenRoundGuard(() => {});
	}
	assert.equal(createSession("unit-guard", eur).player.currency.code, "EUR", "and with no guard it goes through");
});

test("findSession is undefined for a missing or unknown token", () => {
	assert.equal(findSession(undefined), undefined);
	assert.equal(findSession("nope"), undefined);
});

test("rotateToken kills the old token and keeps the new one live", () => {
	const session = createSession("unit-rotate");
	const old = session.token;
	const fresh = rotateToken(session);
	assert.notEqual(fresh, old);
	assert.equal(findSession(old), undefined);
	assert.equal(findSession(fresh), session);
});

test("expireSession kills the token", () => {
	const session = createSession("unit-expire");
	expireSession(session);
	assert.equal(findSession(session.token), undefined);
});

test("a session dies after the TTL of inactivity and every valid lookup restarts the clock", () => {
	mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
	try {
		const session = createSession("unit-ttl");
		mock.timers.tick(config.sessionTtlMs);
		assert.equal(findSession(session.token), session, "exactly the TTL is still alive and resets the clock");
		mock.timers.tick(config.sessionTtlMs);
		assert.equal(findSession(session.token), session, "restarted clock gives a whole new TTL");
		mock.timers.tick(config.sessionTtlMs + 1);
		assert.equal(findSession(session.token), undefined);
		assert.equal(findSession(session.token), undefined, "and it stays dead");
	} finally {
		mock.timers.reset();
	}
});
