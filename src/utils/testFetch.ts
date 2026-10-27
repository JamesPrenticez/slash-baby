// Test support for src/api/*.test.ts: a stubbed fetch plus canned replies. Not imported by app code.
import type { Mock } from "vitest";

import { resetSession } from "@/api/http";
import type { SessionResponse } from "@/types/api";

export const BASE = "http://localhost:3001/api";

export const sessionBody = (sessionToken = "tok-1", currency = "USD"): SessionResponse => ({
	sessionToken,
	playerId: "anon:test",
	balanceMinorUnits: 100000,
	config: {
		mock: true,
		contractVersion: "0.2",
		currency,
		minorUnitExponent: 2,
		minWagerMinorUnits: 10,
		maxWagerMinorUnits: 50000,
		defaultWagerMinorUnits: 100,
		wagerStepsMinorUnits: [10, 100, 1000]
	}
});

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const apiError = (status: number, code: string, message = "nope") => json({ error: { code, message } }, status);

/** Stubs `fetch` for each test in the calling file and clears the client's module state around it. */
export function mockFetch(): Mock<typeof fetch> {
	const fetchMock = vi.fn<typeof fetch>();
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		resetSession();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		resetSession();
	});
	return fetchMock;
}

/** The n-th request the code under test made: path (after the base URL), method, headers, parsed JSON body. */
export function sent(fetchMock: Mock<typeof fetch>, n: number) {
	const [url, init] = fetchMock.mock.calls[n];
	return {
		path: String(url).replace(BASE, ""),
		method: init?.method,
		headers: init?.headers as Record<string, string>,
		body: init?.body ? JSON.parse(String(init.body)) : undefined,
		signal: init?.signal
	};
}

/** `[method path]` of every request so far, for asserting call order. */
export const sentPaths = (fetchMock: Mock<typeof fetch>) =>
	fetchMock.mock.calls.map((_, n) => `${sent(fetchMock, n).method} ${sent(fetchMock, n).path}`);
