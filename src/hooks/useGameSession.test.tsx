import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";

import { ApiError } from "@/api/http";
import { useWalletStore } from "@/stores/walletStore";
import { buildRound } from "@/utils/roundBuilders";
import { apiError, json, mockFetch, sent, sentPaths, sessionBody } from "@/utils/testFetch";

import { describeBootError, useGameSession } from "./useGameSession";

const fetchMock = mockFetch();
const current = (balanceMinorUnits = 5000) => json({ balanceMinorUnits, currency: "USD", active: false });

beforeEach(() => useWalletStore.getState().reset());

describe("useGameSession", () => {
	it("boots session, then current, and takes the balance from current", async () => {
		fetchMock.mockResolvedValueOnce(json(sessionBody())).mockResolvedValueOnce(current(5000));
		const { result } = renderHook(() => useGameSession());
		expect(result.current.status).toBe("loading");

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /game/current"]);
		expect(useWalletStore.getState().balanceMinorUnits).toBe(5000);
		expect(useWalletStore.getState().config?.currency).toBe("USD");
	});

	it("settles a resolved round before the game is ready, and shows the balance the settle returns", async () => {
		const round = buildRound({ status: "resolved" });
		fetchMock
			.mockResolvedValueOnce(json(sessionBody()))
			.mockResolvedValueOnce(json({ balanceMinorUnits: 900, currency: "USD", active: true, round }))
			.mockResolvedValueOnce(
				json({ roundId: "r1", message: { round: { ...round, status: "settled" }, balanceMinorUnits: 1050 } })
			);
		const { result } = renderHook(() => useGameSession());
		expect(result.current.status).toBe("loading");

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /game/current", "POST /game/play"]);
		expect(sent(fetchMock, 2).body.message).toEqual({ settle: { roundId: "r1" } });
		expect(useWalletStore.getState().balanceMinorUnits).toBe(1050);
	});

	it.each(["running", "awaiting_choice", "settled"] as const)("leaves a %s round alone at boot", async status => {
		const round = buildRound({ status });
		fetchMock
			.mockResolvedValueOnce(json(sessionBody()))
			.mockResolvedValueOnce(json({ balanceMinorUnits: 900, currency: "USD", active: true, round }));
		const { result } = renderHook(() => useGameSession());
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(sentPaths(fetchMock)).toEqual(["POST /session", "POST /game/current"]);
		expect(useWalletStore.getState().balanceMinorUnits).toBe(900);
	});

	it("shows the error screen's message when the boot settle fails", async () => {
		const round = buildRound({ status: "resolved" });
		fetchMock
			.mockResolvedValueOnce(json(sessionBody()))
			.mockResolvedValueOnce(json({ balanceMinorUnits: 900, currency: "USD", active: true, round }))
			.mockResolvedValueOnce(apiError(500, "server_error", "boom"));
		const { result } = renderHook(() => useGameSession());
		await waitFor(() => expect(result.current).toMatchObject({ status: "error", message: "boom" }));
	});

	it("reports a server that cannot be reached, and Retry recovers", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const { result } = renderHook(() => useGameSession());
		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current).toMatchObject({ message: expect.stringContaining("game server") });

		fetchMock.mockResolvedValueOnce(json(sessionBody())).mockResolvedValueOnce(current());
		act(() => result.current.retry());
		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});

	it("reports a failure of the current call as an error too", async () => {
		fetchMock.mockResolvedValueOnce(json(sessionBody())).mockResolvedValueOnce(apiError(500, "server_error", "boom"));
		const { result } = renderHook(() => useGameSession());
		await waitFor(() => expect(result.current).toMatchObject({ status: "error", message: "boom" }));
	});

	it("ends ready under StrictMode's double effect", async () => {
		fetchMock.mockImplementation(async input => (String(input).endsWith("/session") ? json(sessionBody()) : current()));
		const { result } = renderHook(() => useGameSession(), { wrapper: StrictMode });
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});
});

describe("describeBootError", () => {
	it.each([
		[0, "network_error"],
		[0, "timeout"]
	] as const)("explains status %i %s in plain words", (status, code) => {
		const error = new ApiError(status, code, "x");
		expect(describeBootError(error)).toMatch(/game server/);
	});

	it("passes any other message through", () => {
		expect(describeBootError(new Error("odd"))).toBe("odd");
		expect(describeBootError("text")).toBe("text");
	});
});
