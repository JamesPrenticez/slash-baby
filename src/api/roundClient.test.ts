import { apiError, json, mockFetch, sent, sentPaths, sessionBody } from "@/utils/testFetch";

import { decide, getBalance, getCurrent, getHistory, getRound, settle, startRound } from "./roundClient";

const fetchMock = mockFetch();

const KEY = "0123456789abcdef0123";
const SERVER_REPLY = { fromServer: true };

/** Answers `/session` with a session and every other path with `reply`. */
function replyWith(reply: () => Response) {
	fetchMock.mockImplementation(async url => (String(url).endsWith("/session") ? json(sessionBody("tok-1")) : reply()));
}

describe("roundClient requests", () => {
	it.each([
		[
			"startRound",
			() => startRound(500, KEY),
			"POST",
			"/game/play",
			{ idempotencyKey: KEY, message: { start: { wagerMinorUnits: 500 } } }
		],
		[
			"decide",
			() => decide({ roundId: "r1", decisionId: "d1", optionId: "o1", sequenceNumber: 2 }, KEY),
			"POST",
			"/game/play",
			{
				idempotencyKey: KEY,
				message: { decide: { roundId: "r1", decisionId: "d1", optionId: "o1", sequenceNumber: 2 } }
			}
		],
		[
			"settle",
			() => settle("r1", KEY),
			"POST",
			"/game/play",
			{ idempotencyKey: KEY, message: { settle: { roundId: "r1" } } }
		],
		["getBalance", () => getBalance(), "GET", "/game/balance", undefined],
		["getCurrent", () => getCurrent(), "POST", "/game/current", {}],
		["getRound", () => getRound("r 1/2"), "GET", "/game/round/r%201%2F2", undefined],
		["getHistory with defaults", () => getHistory(), "GET", "/game/history?limit=10&offset=0", undefined],
		["getHistory paged", () => getHistory(25, 50), "GET", "/game/history?limit=25&offset=50", undefined]
	])("%s sends the contract request and returns the server body", async (_name, call, method, path, body) => {
		replyWith(() => json(SERVER_REPLY));
		await expect(call()).resolves.toEqual(SERVER_REPLY);
		expect(sent(fetchMock, 1)).toMatchObject({ method, path, body });
		expect(sent(fetchMock, 1).headers.Authorization).toBe("Bearer tok-1");
	});

	it("puts the idempotency key and the verb in the body and nothing else", async () => {
		replyWith(() => json(SERVER_REPLY));
		await startRound(100, KEY);
		expect(Object.keys(sent(fetchMock, 1).body)).toEqual(["idempotencyKey", "message"]);
		expect(Object.keys(sent(fetchMock, 1).body.message)).toEqual(["start"]);
	});

	it("passes a stored replay through untouched", async () => {
		const replay = { roundId: "r1", message: { round: {}, balanceMinorUnits: 900, replayed: true } };
		replyWith(() => json(replay));
		await expect(startRound(100, KEY)).resolves.toEqual(replay);
	});

	it("surfaces a rejected wager as an ApiError carrying the server code", async () => {
		replyWith(() => apiError(402, "insufficient_balance", "Wager exceeds balance"));
		await expect(startRound(999999, KEY)).rejects.toMatchObject({
			status: 402,
			code: "insufficient_balance",
			message: "Wager exceeds balance"
		});
	});

	it("retries a 401 exactly once, with the same idempotency key", async () => {
		let playCalls = 0;
		let sessions = 0;
		fetchMock.mockImplementation(async url => {
			if (String(url).endsWith("/session")) return json(sessionBody(`tok-${++sessions}`));
			return ++playCalls === 1 ? apiError(401, "invalid_session") : json(SERVER_REPLY);
		});
		await expect(startRound(100, KEY)).resolves.toEqual(SERVER_REPLY);
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /game/play", "POST /session", "POST /game/play"]);
		expect(sent(fetchMock, 1).body.idempotencyKey).toBe(KEY);
		expect(sent(fetchMock, 3).body.idempotencyKey).toBe(KEY);
		expect(sent(fetchMock, 3).headers.Authorization).toBe("Bearer tok-2");
	});

	it("never sends the same call twice on a network error: reconciliation is the caller's job", async () => {
		fetchMock.mockResolvedValueOnce(json(sessionBody())).mockRejectedValueOnce(new TypeError("offline"));
		await expect(getBalance()).rejects.toMatchObject({ status: 0, code: "network_error" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
