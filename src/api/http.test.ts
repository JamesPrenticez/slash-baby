import { apiError, BASE, json, mockFetch, sent, sentPaths, sessionBody } from "@/utils/testFetch";

import { ApiError, authedRequest, bootstrapSession, onSessionExpired, request } from "./http";

const fetchMock = mockFetch();

/** Answers by method, path and bearer token, so concurrent calls get a deterministic reply. */
function serve(routes: Record<string, () => Response>) {
	fetchMock.mockImplementation(async (url, init) => {
		const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization;
		const key = `${init?.method} ${String(url).replace(BASE, "")} ${bearer ?? ""}`.trim();
		const route = routes[key];
		if (!route) throw new Error(`unexpected request: ${key}`);
		return route();
	});
}

describe("request", () => {
	it("derives the base URL from the page's own hostname on port 3001", async () => {
		fetchMock.mockResolvedValue(json({ ok: true }));
		await request("GET", "/health");
		expect(String(fetchMock.mock.calls[0][0])).toBe(`${location.protocol}//${location.hostname}:3001/api/health`);
	});

	it("uses VITE_API_URL when set", async () => {
		vi.stubEnv("VITE_API_URL", "https://game.example/api");
		fetchMock.mockResolvedValue(json({}));
		await request("GET", "/health");
		expect(String(fetchMock.mock.calls[0][0])).toBe("https://game.example/api/health");
	});

	it("sends no body and no content type on GET, and {} on a bodiless POST", async () => {
		fetchMock.mockImplementation(async () => json({}));
		await request("GET", "/a");
		await request("POST", "/b");
		expect(sent(fetchMock, 0)).toMatchObject({ method: "GET", body: undefined, headers: {} });
		expect(sent(fetchMock, 1)).toMatchObject({
			method: "POST",
			body: {},
			headers: { "Content-Type": "application/json" }
		});
	});

	it("sends the bearer token when given one", async () => {
		fetchMock.mockResolvedValue(json({}));
		await request("GET", "/a", undefined, "tok-9");
		expect(sent(fetchMock, 0).headers.Authorization).toBe("Bearer tok-9");
	});

	it("gives every call a 15 s timeout signal", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		fetchMock.mockResolvedValue(json({}));
		await request("GET", "/a");
		expect(timeout).toHaveBeenCalledWith(15_000);
		expect(sent(fetchMock, 0).signal).toBeInstanceOf(AbortSignal);
	});

	it("parses the server error body into ApiError", async () => {
		fetchMock.mockResolvedValue(apiError(402, "insufficient_balance", "Not enough balance"));
		await expect(request("POST", "/game/play")).rejects.toMatchObject({
			name: "ApiError",
			status: 402,
			code: "insufficient_balance",
			message: "Not enough balance"
		});
	});

	it.each([
		["html", () => new Response("<h1>Bad Gateway</h1>", { status: 502 }), 502],
		["json without an error", () => json({ nope: 1 }, 500), 500],
		["json null", () => json(null, 500), 500],
		["an error with no message", () => json({ error: { code: "server_error" } }, 500), 500]
	])("reports %s as bad_response with the HTTP status", async (_name, response, status) => {
		fetchMock.mockImplementation(async () => response());
		await expect(request("GET", "/x")).rejects.toMatchObject({ status, code: "bad_response" });
	});

	it("reports a rejected fetch as network_error with status 0", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		const error = await request("GET", "/x").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 0, code: "network_error", message: "GET /x failed: Failed to fetch" });
	});

	it("reports a non-Error rejection as network_error", async () => {
		fetchMock.mockRejectedValue("boom");
		await expect(request("GET", "/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
	});

	it("reports a 200 whose body is not JSON as network_error: the server may have applied it", async () => {
		fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
		await expect(request("POST", "/game/play")).rejects.toMatchObject({ status: 0, code: "network_error" });
	});

	it.each(["TimeoutError", "AbortError"])("reports a %s as timeout, never as a loss", async name => {
		fetchMock.mockRejectedValue(new DOMException("aborted", name));
		await expect(request("POST", "/game/play")).rejects.toMatchObject({ status: 0, code: "timeout" });
	});

	it("times out through the real abort signal", async () => {
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.timeout(5));
		fetchMock.mockImplementation(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					const signal = init?.signal as AbortSignal;
					if (signal.aborted) reject(signal.reason);
					signal.addEventListener("abort", () => reject(signal.reason));
				})
		);
		await expect(request("GET", "/slow")).rejects.toMatchObject({ status: 0, code: "timeout" });
	});
});

describe("bootstrapSession", () => {
	it("posts to /session and returns the SessionResponse", async () => {
		fetchMock.mockResolvedValue(json(sessionBody("tok-1")));
		await expect(bootstrapSession()).resolves.toEqual(sessionBody("tok-1"));
		expect(sent(fetchMock, 0)).toMatchObject({ path: "/session", method: "POST", body: {} });
		expect(sent(fetchMock, 0).headers.Authorization).toBeUndefined();
	});

	it("sends the wanted currency", async () => {
		fetchMock.mockResolvedValue(json(sessionBody("tok-1", "JPY")));
		await bootstrapSession("JPY");
		expect(sent(fetchMock, 0).body).toEqual({ currency: "JPY" });
	});

	it("uses /debug/session with a tester id when VITE_DEBUG is true", async () => {
		vi.stubEnv("VITE_DEBUG", "true");
		fetchMock.mockResolvedValue(json(sessionBody("tok-1")));
		await bootstrapSession("EUR");
		expect(sent(fetchMock, 0).path).toBe("/debug/session");
		expect(sent(fetchMock, 0).body).toEqual({
			playerId: expect.stringMatching(/^tester-[0-9a-f]{8}$/),
			currency: "EUR"
		});
	});

	it("shares one in-flight request between concurrent callers", async () => {
		fetchMock.mockResolvedValue(json(sessionBody("tok-1")));
		const [a, b] = await Promise.all([bootstrapSession(), bootstrapSession()]);
		expect(a).toBe(b);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("can be retried after a failure", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("down")).mockResolvedValueOnce(json(sessionBody("tok-1")));
		await expect(bootstrapSession()).rejects.toMatchObject({ code: "network_error" });
		await expect(bootstrapSession()).resolves.toMatchObject({ sessionToken: "tok-1" });
	});
});

describe("authedRequest", () => {
	it("bootstraps first, then carries the bearer token on every call", async () => {
		serve({
			"POST /session": () => json(sessionBody("tok-1")),
			"GET /game/balance Bearer tok-1": () => json({ balanceMinorUnits: 5, currency: "USD" })
		});
		await expect(authedRequest("GET", "/game/balance")).resolves.toEqual({ balanceMinorUnits: 5, currency: "USD" });
		await authedRequest("GET", "/game/balance");
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "GET /game/balance", "GET /game/balance"]);
	});

	it("does not retry a definite error that is not a 401", async () => {
		serve({
			"POST /session": () => json(sessionBody("tok-1")),
			"POST /game/play Bearer tok-1": () => apiError(409, "round_already_started")
		});
		await expect(authedRequest("POST", "/game/play", { idempotencyKey: "k" })).rejects.toMatchObject({
			status: 409,
			code: "round_already_started"
		});
		expect(sentPaths(fetchMock)).toHaveLength(2);
	});

	it("on 401 notifies, re-bootstraps and retries once with the same body", async () => {
		const sessions = [sessionBody("tok-1"), sessionBody("tok-2")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"POST /game/play Bearer tok-1": () => apiError(401, "invalid_session"),
			"POST /game/play Bearer tok-2": () => json({ roundId: "r1" })
		});
		const expired = vi.fn();
		onSessionExpired(expired);
		const body = { idempotencyKey: "0123456789abcdef", message: { start: { wagerMinorUnits: 100 } } };

		await expect(authedRequest("POST", "/game/play", body)).resolves.toEqual({ roundId: "r1" });

		expect(expired).toHaveBeenCalledTimes(1);
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /game/play", "POST /session", "POST /game/play"]);
		expect(sent(fetchMock, 1).body).toEqual(body);
		expect(sent(fetchMock, 3).body).toEqual(body);
		expect(sent(fetchMock, 3).headers.Authorization).toBe("Bearer tok-2");
	});

	it("throws on a second 401 and retries exactly once", async () => {
		const sessions = [sessionBody("tok-1"), sessionBody("tok-2")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"GET /game/balance Bearer tok-1": () => apiError(401, "invalid_session"),
			"GET /game/balance Bearer tok-2": () => apiError(401, "invalid_session")
		});
		await expect(authedRequest("GET", "/game/balance")).rejects.toMatchObject({
			status: 401,
			code: "invalid_session"
		});
		expect(sentPaths(fetchMock)).toHaveLength(4);
	});

	it("throws the bootstrap error when the re-bootstrap fails", async () => {
		fetchMock
			.mockResolvedValueOnce(json(sessionBody("tok-1")))
			.mockResolvedValueOnce(apiError(401, "invalid_session"))
			.mockRejectedValueOnce(new TypeError("down"));
		await expect(authedRequest("GET", "/game/balance")).rejects.toMatchObject({ code: "network_error" });
	});

	it("shares one re-bootstrap and one notification between concurrent 401s", async () => {
		const sessions = [sessionBody("tok-1"), sessionBody("tok-2")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"GET /game/balance Bearer tok-1": () => apiError(401, "invalid_session"),
			"GET /game/balance Bearer tok-2": () => json({ balanceMinorUnits: 1, currency: "USD" })
		});
		await bootstrapSession();
		const expired = vi.fn();
		onSessionExpired(expired);

		await Promise.all([authedRequest("GET", "/game/balance"), authedRequest("GET", "/game/balance")]);

		expect(expired).toHaveBeenCalledTimes(1);
		expect(sentPaths(fetchMock).filter(p => p === "POST /session")).toHaveLength(2);
	});

	it("keeps the player's currency across a re-bootstrap", async () => {
		const sessions = [sessionBody("tok-1", "JPY"), sessionBody("tok-2", "JPY")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"GET /game/balance Bearer tok-1": () => apiError(401, "invalid_session"),
			"GET /game/balance Bearer tok-2": () => json({})
		});
		await bootstrapSession("JPY");
		await authedRequest("GET", "/game/balance");
		expect(sent(fetchMock, 2)).toMatchObject({ path: "/session", body: { currency: "JPY" } });
	});

	it("stops notifying after unsubscribe", async () => {
		const sessions = [sessionBody("tok-1"), sessionBody("tok-2")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"GET /x Bearer tok-1": () => apiError(401, "invalid_session"),
			"GET /x Bearer tok-2": () => json({})
		});
		const expired = vi.fn();
		onSessionExpired(expired)();
		await authedRequest("GET", "/x");
		expect(expired).not.toHaveBeenCalled();
	});
});

describe("token refresh", () => {
	const TWENTY_MINUTES = 20 * 60 * 1000;
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	});

	it("rotates the token every 20 minutes and uses the new one", async () => {
		serve({
			"POST /session": () => json(sessionBody("tok-1")),
			"POST /session/refresh Bearer tok-1": () => json({ sessionToken: "tok-2" }),
			"GET /x Bearer tok-2": () => json({})
		});
		await bootstrapSession();
		await vi.advanceTimersByTimeAsync(TWENTY_MINUTES - 1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await authedRequest("GET", "/x");
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /session/refresh", "GET /x"]);
	});

	it("does not swap in a refreshed token if the session was replaced meanwhile", async () => {
		let finishRefresh!: (res: Response) => void;
		const sessions = [sessionBody("tok-1"), sessionBody("tok-3")];
		serve({
			"POST /session": () => json(sessions.shift()),
			"GET /x Bearer tok-3": () => json({})
		});
		await bootstrapSession();
		fetchMock.mockImplementationOnce(() => new Promise(resolve => (finishRefresh = resolve)));
		await vi.advanceTimersByTimeAsync(TWENTY_MINUTES);
		await bootstrapSession();
		finishRefresh(json({ sessionToken: "tok-2" }));
		await vi.advanceTimersByTimeAsync(0);
		await authedRequest("GET", "/x");
		expect(sent(fetchMock, 3).headers.Authorization).toBe("Bearer tok-3");
	});

	it("survives a failed refresh and keeps the token", async () => {
		serve({
			"POST /session": () => json(sessionBody("tok-1")),
			"POST /session/refresh Bearer tok-1": () => apiError(500, "server_error"),
			"GET /x Bearer tok-1": () => json({})
		});
		await bootstrapSession();
		await vi.advanceTimersByTimeAsync(TWENTY_MINUTES);
		await expect(authedRequest("GET", "/x")).resolves.toEqual({});
	});

	it("skips the tick while there is no token", async () => {
		fetchMock
			.mockResolvedValueOnce(json(sessionBody("tok-1")))
			.mockResolvedValueOnce(apiError(401, "invalid_session"))
			.mockRejectedValueOnce(new TypeError("down"));
		await expect(authedRequest("GET", "/x")).rejects.toMatchObject({ code: "network_error" });
		await vi.advanceTimersByTimeAsync(TWENTY_MINUTES);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
