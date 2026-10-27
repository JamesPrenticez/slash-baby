import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/api/http";
import { getHistory, settle, startRound } from "@/api/roundClient";
import { useBottomBarStore } from "@/stores/bottomBarStore";
import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";
import { useRoundStore } from "@/stores/roundStore";
import { useWalletStore } from "@/stores/walletStore";
import type { HistoryEntry } from "@/types/round";
import { buildRound } from "@/utils/roundBuilders";
import { sessionBody } from "@/utils/testFetch";

import { UserInterface } from "./UserInterface";

vi.mock("@/api/roundClient", () => ({ getHistory: vi.fn(), startRound: vi.fn(), settle: vi.fn() }));

const entry = (n: number, payoutMinorUnits = 0): HistoryEntry => ({
	roundId: `round-${n}`,
	createdAt: "2026-10-26T10:00:00.000Z",
	settledAt: "2026-10-26T10:00:05.000Z",
	wagerMinorUnits: 100,
	payoutMinorUnits,
	currency: "USD",
	category: payoutMinorUnits ? "small_win" : "loss"
});

const history = (rounds: HistoryEntry[], total = rounds.length) =>
	vi.mocked(getHistory).mockResolvedValue({ rounds, total });

const openFromMenu = async (row: string) => {
	await userEvent.click(screen.getByRole("button", { name: "Menu" }));
	await userEvent.click(within(screen.getByRole("dialog", { name: "Menu" })).getByText(row));
};

beforeEach(() => {
	vi.mocked(getHistory).mockReset();
	history([entry(2, 250), entry(1)]);
	useWalletStore.getState().reset();
	useWalletStore.getState().setSession({ ...sessionBody(), balanceMinorUnits: 123456 });
	useBottomBarStore.setState(useBottomBarStore.getInitialState(), true);
});

describe("UserInterface", () => {
	it("shows the server balance formatted for its currency, in the bar", () => {
		render(<UserInterface />);
		expect(screen.getAllByText("$1,234.56").length).toBeGreaterThan(0);
	});

	it("formats an exponent-0 currency without decimals", () => {
		useWalletStore.getState().setSession({
			...sessionBody("t", "JPY"),
			balanceMinorUnits: 123456,
			config: { ...sessionBody().config, currency: "JPY", minorUnitExponent: 0 }
		});
		render(<UserInterface />);
		expect(screen.getAllByText("¥123,456").length).toBeGreaterThan(0);
	});

	it("loads the history for the strip when it mounts, and shows the server's payouts", async () => {
		render(<UserInterface />);
		const strip = await screen.findByRole("list", { name: "Recent rounds" });
		expect(getHistory).toHaveBeenCalledWith(10, 0);
		expect(
			within(strip)
				.getAllByRole("listitem")
				.map(li => li.textContent)
		).toEqual(["$2.50", "$0.00"]);
	});

	describe("a round", () => {
		const resolved = buildRound({
			status: "resolved",
			currency: "USD",
			outcome: {
				roundId: "r1",
				outcomeId: "o1",
				category: "big_win",
				payoutMinorUnits: 500,
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
				payoutMinorUnits: 500,
				currency: "USD",
				settlementId: "s1",
				settledAt: "2026-01-01T00:00:01.000Z"
			}
		});
		const reply = (round: typeof resolved, balanceMinorUnits: number) => ({
			roundId: "r1",
			message: { round, balanceMinorUnits }
		});
		const play = () => userEvent.click(screen.getByRole("button", { name: "PLAY" }));
		const finishPresentation = () => act(() => usePresentationStore.getState().tick(10_000));

		beforeEach(() => {
			useRoundStore.getState().reset();
			resetPresentationStore();
			vi.mocked(startRound).mockResolvedValue(reply(resolved, 123356));
			vi.mocked(settle).mockResolvedValue(reply(settled, 123856));
		});

		it("locks PLAY and the bet from the press, shows the results from the server, and Continue unlocks them", async () => {
			render(<UserInterface />);
			await play();
			await waitFor(() => expect(screen.getByRole("button", { name: "PLAY" })).toBeDisabled());
			expect(screen.getByRole("button", { name: "PLAY" })).toHaveAttribute("aria-busy", "true");
			expect(screen.getByRole("button", { name: "Increase bet" })).toBeDisabled();
			expect(startRound).toHaveBeenCalledWith(100, expect.any(String));
			expect(screen.queryByRole("dialog", { name: "Big win" })).not.toBeInTheDocument();

			finishPresentation();
			const results = await screen.findByRole("dialog", { name: "Big win" });
			expect(within(results).getByText("$5.00")).toBeInTheDocument();
			expect(within(results).getByText("$1,238.56")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "PLAY" })).toBeDisabled();

			await userEvent.click(within(results).getByRole("button", { name: "Continue" }));
			expect(screen.queryByRole("dialog", { name: "Big win" })).not.toBeInTheDocument();
			expect(screen.getByRole("button", { name: "PLAY" })).toBeEnabled();
			expect(screen.getByRole("button", { name: "Increase bet" })).toBeEnabled();
			expect(getHistory).toHaveBeenCalledTimes(2);
		});

		it("shows a network failure with Retry, and Retry carries the round on", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(0, "network_error", "x"));
			render(<UserInterface />);
			await play();
			expect(await screen.findByRole("alert")).toHaveTextContent(/could not be reached/);
			await userEvent.click(screen.getByRole("button", { name: "Retry" }));
			await waitFor(() => expect(usePresentationStore.getState().status).toBe("running"));
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
			expect(startRound).toHaveBeenCalledTimes(2);
		});

		it("shows the server's message for a refused bet, with no Retry, and PLAY stays available", async () => {
			vi.mocked(startRound).mockRejectedValueOnce(new ApiError(402, "insufficient_balance", "Not enough balance"));
			render(<UserInterface />);
			await play();
			expect(await screen.findByRole("alert")).toHaveTextContent("Not enough balance");
			expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
			expect(screen.getByRole("button", { name: "PLAY" })).toBeEnabled();
		});
	});

	it("the menu opens game info and closes with Escape", async () => {
		render(<UserInterface />);
		await openFromMenu("Game info");
		expect(screen.getByRole("dialog", { name: "GAME INFO" })).toBeInTheDocument();
		expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog", { name: "GAME INFO" })).not.toBeInTheDocument();
	});

	it("the menu opens bet history, which reloads on open and pages with LOAD MORE", async () => {
		history([entry(2, 250), entry(1)], 3);
		render(<UserInterface />);
		await screen.findByRole("list", { name: "Recent rounds" });
		vi.mocked(getHistory).mockClear();

		await openFromMenu("History");
		const modal = screen.getByRole("dialog", { name: "BET HISTORY" });
		await waitFor(() => expect(getHistory).toHaveBeenCalledWith(10, 0));
		expect(await within(modal).findAllByRole("listitem")).toHaveLength(2);

		vi.mocked(getHistory).mockResolvedValue({ rounds: [entry(0)], total: 3 });
		await userEvent.click(within(modal).getByRole("button", { name: "LOAD MORE" }));
		await waitFor(() => expect(getHistory).toHaveBeenLastCalledWith(10, 2));
		await waitFor(() => expect(within(modal).getAllByRole("listitem")).toHaveLength(3));

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog", { name: "BET HISTORY" })).not.toBeInTheDocument();
	});

	it("an unreachable history leaves the screen working with an empty list", async () => {
		vi.mocked(getHistory).mockRejectedValue(new Error("down"));
		render(<UserInterface />);
		await openFromMenu("History");
		expect(await screen.findByText("No rounds yet.")).toBeInTheDocument();
	});

	it("the audio button opens the volume popover, and Escape closes it", async () => {
		render(<UserInterface />);
		await userEvent.click(screen.getByRole("button", { name: "Mute" }));
		expect(screen.getByRole("dialog", { name: "Volume" })).toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog", { name: "Volume" })).not.toBeInTheDocument();
	});
});
