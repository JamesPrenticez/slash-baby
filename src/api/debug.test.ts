import type { DebugRoundResponse } from "@/types/debug";
import { apiError, json, mockFetch, sent, sessionBody } from "@/utils/testFetch";

import {
	bootstrapDebugSession,
	creditBalance,
	expireSession,
	getDebugPlayerId,
	getDebugRound,
	getDebugState,
	resetPlayer,
	setBalance,
	setForce,
	setSeed,
	setSimulation,
	switchCurrency
} from "./debug";
import { authedRequest } from "./http";

const fetchMock = mockFetch();
const TESTER_ID = /^tester-[0-9a-f]{8}$/;

beforeEach(() => vi.stubEnv("VITE_DEBUG", "true"));

/** Answers `/session` with a session and every other path with `reply`. */
function replyWith(reply: () => Response) {
	fetchMock.mockImplementation(async url => (String(url).endsWith("/session") ? json(sessionBody("tok-1")) : reply()));
}

describe("debug wrappers", () => {
	const FORCE = { fixtureId: null, category: "jackpot", policy: null, sticky: true } as const;

	it.each([
		["getDebugState", () => getDebugState(), "GET", "/debug/state", undefined],
		["setBalance", () => setBalance(250), "POST", "/debug/balance/set", { balanceMinorUnits: 250 }],
		[
			"creditBalance with an amount",
			() => creditBalance(5000),
			"POST",
			"/debug/balance/credit",
			{ amountMinorUnits: 5000 }
		],
		["creditBalance with the server default", () => creditBalance(), "POST", "/debug/balance/credit", {}],
		["setForce", () => setForce(FORCE), "POST", "/debug/force", FORCE],
		["setForce null", () => setForce(null), "POST", "/debug/force", { force: null }],
		["setSimulation", () => setSimulation({ latencyMs: 300 }), "POST", "/debug/simulate", { latencyMs: 300 }],
		["resetPlayer", () => resetPlayer(), "POST", "/debug/reset", {}],
		["expireSession", () => expireSession(), "POST", "/debug/expire-session", {}],
		["setSeed", () => setSeed("abc"), "POST", "/debug/seed", { seed: "abc" }],
		["setSeed null", () => setSeed(null), "POST", "/debug/seed", { seed: null }],
		["getDebugRound", () => getDebugRound("r/1"), "GET", "/debug/round/r%2F1", undefined]
	])("%s calls its contract route with the bearer token", async (_name, call, method, path, body) => {
		replyWith(() => json({ ok: true }));
		await expect(call()).resolves.toEqual({ ok: true });
		expect(sent(fetchMock, 1)).toMatchObject({ method, path, body });
		expect(sent(fetchMock, 1).headers.Authorization).toBe("Bearer tok-1");
	});

	it("getDebugRound is typed as DebugRoundResponse and returns the nested round and debug info untouched", async () => {
		expectTypeOf(getDebugRound).returns.resolves.toEqualTypeOf<DebugRoundResponse>();
		const body = {
			round: { roundId: "r1", status: "settled" },
			debug: { fixtureId: "loss_1", forced: null, seed: "s", roundIndex: 0, statusHistory: [], idempotencyKeys: [] }
		};
		replyWith(() => json(body));
		await expect(getDebugRound("r1")).resolves.toEqual(body);
	});

	it("surfaces a debug-off server (404 not_found) as an ApiError", async () => {
		replyWith(() => apiError(404, "not_found", "No such route"));
		await expect(getDebugState()).rejects.toMatchObject({ status: 404, code: "not_found" });
	});
});

describe("bootstrapDebugSession", () => {
	it("posts the tester id and currency to /debug/session without a token", async () => {
		fetchMock.mockResolvedValue(json(sessionBody("tok-1")));
		await expect(bootstrapDebugSession("GBP")).resolves.toEqual(sessionBody("tok-1"));
		expect(sent(fetchMock, 0)).toMatchObject({
			method: "POST",
			path: "/debug/session",
			body: { playerId: getDebugPlayerId(), currency: "GBP" }
		});
		expect(sent(fetchMock, 0).headers.Authorization).toBeUndefined();
	});
});

describe("switchCurrency", () => {
	it("swaps in a new session for the new currency", async () => {
		fetchMock
			.mockResolvedValueOnce(json(sessionBody("tok-1", "USD")))
			.mockResolvedValueOnce(json(sessionBody("tok-2", "JPY")))
			.mockResolvedValue(json({}));
		await switchCurrency("USD");
		await expect(switchCurrency("JPY")).resolves.toMatchObject({ config: { currency: "JPY" } });
		await authedRequest("GET", "/game/balance");
		expect(sent(fetchMock, 1).body).toEqual({ playerId: getDebugPlayerId(), currency: "JPY" });
		expect(sent(fetchMock, 2).headers.Authorization).toBe("Bearer tok-2");
	});

	it("keeps the old session when the server refuses (round open)", async () => {
		fetchMock
			.mockResolvedValueOnce(json(sessionBody("tok-1")))
			.mockResolvedValueOnce(apiError(409, "round_already_started"))
			.mockResolvedValue(json({}));
		await switchCurrency("USD");
		await expect(switchCurrency("JPY")).rejects.toMatchObject({ status: 409, code: "round_already_started" });
		await authedRequest("GET", "/game/balance");
		expect(sent(fetchMock, 2).headers.Authorization).toBe("Bearer tok-1");
	});
});

describe("getDebugPlayerId", () => {
	// The id is cached per module instance, so each case loads a fresh one.
	const freshGetter = async () => {
		vi.resetModules();
		return (await import("./debug")).getDebugPlayerId;
	};

	beforeEach(() => localStorage.clear());

	it("generates a tester id once, stores it and returns it every call", async () => {
		const get = await freshGetter();
		const id = get();
		expect(id).toMatch(TESTER_ID);
		expect(get()).toBe(id);
		expect(localStorage.getItem("debugPlayerId")).toBe(id);
	});

	it("reuses the id stored by an earlier page load", async () => {
		localStorage.setItem("debugPlayerId", "tester-deadbeef");
		const get = await freshGetter();
		expect(get()).toBe("tester-deadbeef");
	});

	it("keeps one id for the page when storage is blocked", async () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			}
		});
		const get = await freshGetter();
		const id = get();
		expect(id).toMatch(TESTER_ID);
		expect(get()).toBe(id);
	});
});
