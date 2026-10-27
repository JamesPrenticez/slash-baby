import { act, renderHook, waitFor } from "@testing-library/react";

import { ApiError } from "@/api/http";
import { settle, startRound } from "@/api/roundClient";
import { PRESENTATION_MAPS } from "@/constants/presentationMaps";
import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";
import { useRoundStore } from "@/stores/roundStore";
import { useWalletStore } from "@/stores/walletStore";
import type { PlayResponse } from "@/types/api";
import type { RoundRecord } from "@/types/round";
import { buildRound } from "@/utils/roundBuilders";
import { sessionBody } from "@/utils/testFetch";

import { useRound } from "./useRound";

vi.mock("@/api/roundClient", () => ({ startRound: vi.fn(), settle: vi.fn() }));

const reply = (round: RoundRecord, balanceMinorUnits: number): PlayResponse => ({
	roundId: round.roundId,
	message: { round, balanceMinorUnits }
});

const resolved = buildRound({
	status: "resolved",
	outcome: {
		roundId: "r1",
		outcomeId: "o1",
		category: "small_win",
		payoutMinorUnits: 150,
		presentationId: "victory",
		resolutionVersion: "1"
	}
});
const settled = buildRound({
	...resolved,
	status: "settled",
	settlement: {
		roundId: "r1",
		wagerMinorUnits: 100,
		payoutMinorUnits: 150,
		currency: "EUR",
		settlementId: "s1",
		settledAt: "2026-01-01T00:00:01.000Z"
	}
});

const PLAN_MS = 5300;
const runPlan = () => act(() => usePresentationStore.getState().tick(PLAN_MS));

beforeEach(() => {
	vi.resetAllMocks();
	useRoundStore.getState().reset();
	resetPresentationStore();
	useWalletStore.getState().reset();
	useWalletStore.getState().setSession({ ...sessionBody(), balanceMinorUnits: 1000 });
	vi.mocked(startRound).mockResolvedValue(reply(resolved, 900));
	vi.mocked(settle).mockResolvedValue(reply(settled, 1050));
});

const started = async () => {
	const hook = renderHook(() => useRound());
	act(() => hook.result.current.play());
	await waitFor(() => expect(usePresentationStore.getState().status).toBe("running"));
	return hook;
};

describe("useRound", () => {
	it("bets, plays the round's plan, settles once it ends and shows the server's numbers", async () => {
		const { result } = await started();
		expect(startRound).toHaveBeenCalledWith(100, expect.any(String));
		expect(usePresentationStore.getState().plan).toBe(PRESENTATION_MAPS.plan_loss);
		expect(useWalletStore.getState().balanceMinorUnits).toBe(900);
		expect(result.current.busy).toBe(true);
		expect(result.current.results).toBeNull();
		expect(settle).not.toHaveBeenCalled();

		runPlan();
		await waitFor(() => expect(result.current.results).not.toBeNull());
		expect(settle).toHaveBeenCalledWith("r1", expect.any(String));
		expect(result.current.results).toEqual({ payoutMinorUnits: 150, category: "small_win", balanceMinorUnits: 1050 });
		expect(result.current.busy).toBe(true);
	});

	it("closing the results returns to the bet screen, keeps the debug playback speed and allows the next round", async () => {
		usePresentationStore.getState().setSpeed(4);
		const { result } = await started();
		runPlan();
		await waitFor(() => expect(result.current.results).not.toBeNull());

		act(() => result.current.close());
		expect(result.current.busy).toBe(false);
		expect(result.current.results).toBeNull();
		expect(usePresentationStore.getState().playbackSpeed).toBe(4);

		act(() => result.current.play());
		await waitFor(() => expect(startRound).toHaveBeenCalledTimes(2));
	});

	it("a double click makes one round", async () => {
		const { result } = renderHook(() => useRound());
		act(() => {
			result.current.play();
			result.current.play();
		});
		await waitFor(() => expect(usePresentationStore.getState().status).toBe("running"));
		expect(startRound).toHaveBeenCalledTimes(1);
	});

	it("a cancelled presentation still settles", async () => {
		const { result } = await started();
		act(() => usePresentationStore.getState().cancel());
		await waitFor(() => expect(result.current.results).not.toBeNull());
	});

	it("falls back to a known plan for an id it does not have", async () => {
		vi.mocked(startRound).mockResolvedValue(reply({ ...resolved, eventPlanId: "plan_future" as never }, 900));
		await started();
		expect(usePresentationStore.getState().plan).toBe(PRESENTATION_MAPS.plan_loss);
	});

	describe("a failed start", () => {
		it("on a network error offers Retry, which resends the same key and carries on", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(0, "network_error", "x"));
			const { result } = renderHook(() => useRound());
			act(() => result.current.play());
			await waitFor(() => expect(result.current.error).not.toBeNull());
			expect(result.current.error).toMatchObject({ retryable: true, message: expect.stringContaining("server") });
			expect(result.current.busy).toBe(true);

			act(() => result.current.play());
			expect(startRound).toHaveBeenCalledTimes(1);

			act(() => result.current.retry());
			await waitFor(() => expect(usePresentationStore.getState().status).toBe("running"));
			expect(result.current.error).toBeNull();
			const [[, first], [, second]] = vi.mocked(startRound).mock.calls;
			expect(second).toBe(first);
		});

		it("on a 5xx offers Retry with the server's message", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(500, "simulated_error", "boom"));
			const { result } = renderHook(() => useRound());
			act(() => result.current.play());
			await waitFor(() => expect(result.current.error).toEqual({ message: "boom", retryable: true }));
		});

		it("on a 4xx shows the server's message with no Retry and leaves PLAY available", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(402, "insufficient_balance", "Not enough balance"));
			const { result } = renderHook(() => useRound());
			act(() => result.current.play());
			await waitFor(() => expect(result.current.error).toEqual({ message: "Not enough balance", retryable: false }));
			expect(result.current.busy).toBe(false);

			act(() => result.current.play());
			await waitFor(() => expect(startRound).toHaveBeenCalledTimes(2));
			const [[, first], [, second]] = vi.mocked(startRound).mock.calls;
			expect(second).not.toBe(first);
		});

		it("a reply that is not a contract body may have been applied, so it can be retried", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(200, "bad_response", "bad"));
			const { result } = renderHook(() => useRound());
			act(() => result.current.play());
			await waitFor(() => expect(result.current.error?.retryable).toBe(true));
		});

		it("an unexpected error is shown without Retry", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new Error("odd"));
			const { result } = renderHook(() => useRound());
			act(() => result.current.play());
			await waitFor(() => expect(result.current.error).toEqual({ message: "odd", retryable: false }));
		});
	});

	describe("a failed settle", () => {
		it("offers Retry, which resends the same key and reaches the results", async () => {
			vi.mocked(settle).mockRejectedValueOnce(new ApiError(0, "timeout", "x"));
			const { result } = await started();
			runPlan();
			await waitFor(() => expect(result.current.error?.retryable).toBe(true));
			expect(result.current.results).toBeNull();

			act(() => result.current.retry());
			await waitFor(() => expect(result.current.results).not.toBeNull());
			const [[, first], [, second]] = vi.mocked(settle).mock.calls;
			expect(second).toBe(first);
			expect(result.current.error).toBeNull();
		});

		it("a definite refusal shows the message with no Retry and keeps the round", async () => {
			vi.mocked(settle).mockRejectedValueOnce(new ApiError(409, "round_not_resolved", "Not resolved"));
			const { result } = await started();
			runPlan();
			await waitFor(() => expect(result.current.error).toEqual({ message: "Not resolved", retryable: false }));
			expect(result.current.busy).toBe(true);
		});
	});

	it("does not settle a round the server has not resolved", async () => {
		vi.mocked(startRound).mockResolvedValue(reply({ ...resolved, status: "running", outcome: null }, 900));
		await started();
		runPlan();
		await waitFor(() => expect(useRoundStore.getState().local.presentation).toBe("finished"));
		expect(settle).not.toHaveBeenCalled();
	});
});
