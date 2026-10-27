import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getDebugRound, getDebugState, setForce, setSeed } from "@/api/debug";
import { ApiError } from "@/api/http";
import { getRound } from "@/api/roundClient";
import { PRESENTATION_MAPS } from "@/constants/presentationMaps";
import { resetPresentationStore, usePresentationStore } from "@/stores/presentationStore";
import { useRoundStore } from "@/stores/roundStore";
import type { DebugRoundResponse, DebugState } from "@/types/debug";
import { buildRound } from "@/utils/roundBuilders";

import { RoundsSection } from "./RoundsSection";

vi.mock("@/api/debug");
vi.mock("@/api/roundClient", () => ({ getRound: vi.fn() }));

const state = (over: Partial<DebugState> = {}) =>
	({
		seed: "default",
		roundsPlayed: 3,
		force: null,
		fixtures: [
			{ fixtureId: "loss_1", category: "loss", policy: "fixed", eventPlanId: "plan_loss", decisionPointIds: [] },
			{
				fixtureId: "jackpot_1",
				category: "jackpot",
				policy: "fixed",
				eventPlanId: "plan_jackpot",
				decisionPointIds: []
			}
		],
		...over
	}) as DebugState;

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getDebugState).mockResolvedValue(state());
	useRoundStore.getState().reset();
	resetPresentationStore();
});

const pick = (name: string, value: string) => userEvent.selectOptions(screen.getByRole("combobox", { name }), value);

describe("RoundsSection", () => {
	it("reads the server's seed, round counter and force", async () => {
		vi.mocked(getDebugState).mockResolvedValue(
			state({ force: { fixtureId: null, category: "loss", policy: null, sticky: true } })
		);
		render(<RoundsSection />);
		expect(await screen.findByText("default (#3)")).toBeInTheDocument();
		expect(screen.getByTestId("round-force")).toHaveTextContent('"category":"loss"');
	});

	it("forces a fixture with the sticky flag, and clears it", async () => {
		vi.mocked(setForce).mockResolvedValue(state({ roundsPlayed: 4 }));
		render(<RoundsSection />);
		await screen.findByRole("option", { name: "jackpot_1 (plan_jackpot)" });
		await pick("Fixture", "jackpot_1");
		await pick("Policy", "fixed");
		await userEvent.click(screen.getByRole("checkbox"));
		await userEvent.click(screen.getByRole("button", { name: "Force" }));
		expect(setForce).toHaveBeenCalledWith({ fixtureId: "jackpot_1", category: null, policy: "fixed", sticky: true });
		expect(await screen.findByText("default (#4)")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Clear force" }));
		expect(setForce).toHaveBeenLastCalledWith(null);
	});

	it("forces a category", async () => {
		vi.mocked(setForce).mockResolvedValue(state());
		render(<RoundsSection />);
		await screen.findByRole("option", { name: "jackpot" });
		await pick("Category", "jackpot");
		await userEvent.click(screen.getByRole("button", { name: "Force" }));
		expect(setForce).toHaveBeenCalledWith({ fixtureId: null, category: "jackpot", policy: null, sticky: false });
	});

	it("shows the server's refusal code", async () => {
		vi.mocked(setForce).mockRejectedValue(new ApiError(400, "invalid_debug_request", "no fixture"));
		render(<RoundsSection />);
		await userEvent.click(screen.getByRole("button", { name: "Force" }));
		expect(await screen.findByText("Force: invalid_debug_request")).toBeInTheDocument();
	});

	it("sets the seed, or restores the default", async () => {
		vi.mocked(setSeed).mockResolvedValue(state({ seed: "abc", roundsPlayed: 0 }));
		render(<RoundsSection />);
		expect(screen.getByRole("button", { name: "Set seed" })).toBeDisabled();
		await userEvent.type(screen.getByRole("textbox", { name: "Seed" }), "abc");
		await userEvent.click(screen.getByRole("button", { name: "Set seed" }));
		expect(setSeed).toHaveBeenCalledWith("abc");
		expect(await screen.findByText("abc (#0)")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Default seed" }));
		expect(setSeed).toHaveBeenLastCalledWith(null);
	});

	it("replays a round's plan by id without touching the round store", async () => {
		vi.mocked(getRound).mockResolvedValue({ round: buildRound({ roundId: "old", eventPlanId: "plan_jackpot" }) });
		render(<RoundsSection />);
		await userEvent.type(screen.getByRole("textbox", { name: "Round id" }), "old");
		await userEvent.click(screen.getByRole("button", { name: "Replay" }));
		expect(getRound).toHaveBeenCalledWith("old");
		await waitFor(() => expect(usePresentationStore.getState().plan).toBe(PRESENTATION_MAPS.plan_jackpot));
		expect(useRoundStore.getState().round).toBeNull();
	});

	it("shows a round's JSON from the debug route and tries the clipboard", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });
		const body = { round: buildRound({ roundId: "r9" }), debug: { fixtureId: "loss_1" } } as DebugRoundResponse;
		vi.mocked(getDebugRound).mockResolvedValue(body);
		useRoundStore.getState().setRound(buildRound({ roundId: "r9" }));
		render(<RoundsSection />);
		await userEvent.click(screen.getByRole("button", { name: "Copy round JSON" }));
		expect(getDebugRound).toHaveBeenCalledWith("r9");
		expect(await screen.findByRole("textbox", { name: "Round JSON" })).toHaveValue(JSON.stringify(body, null, 2));
		expect(writeText).toHaveBeenCalledWith(JSON.stringify(body, null, 2));
		vi.unstubAllGlobals();
	});

	it("reads the client's round state", () => {
		useRoundStore.getState().setRound(buildRound({ roundId: "r9", status: "resolved", eventPlanId: "plan_big_win" }));
		useRoundStore.getState().beginAction("settle");
		render(<RoundsSection />);
		expect(screen.getByTestId("round-id")).toHaveTextContent("r9");
		expect(screen.getByTestId("round-status")).toHaveTextContent("resolved");
		expect(screen.getByTestId("round-plan")).toHaveTextContent("plan_big_win");
		expect(screen.getByTestId("round-pending")).toHaveTextContent("settle");
		expect(screen.getByTestId("round-state")).toHaveTextContent("PRESENTATION_RUNNING");
	});
});
