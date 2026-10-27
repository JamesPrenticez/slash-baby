import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getDebugState, setSimulation } from "@/api/debug";
import { ApiError } from "@/api/http";
import type { DebugSimulation, DebugState } from "@/types/debug";

import { NetworkSection } from "./NetworkSection";

vi.mock("@/api/debug");

const quiet: DebugSimulation = { latencyMs: 0, errorRate: 0, failNext: null, dropAfterAccept: 0, resolveDelayMs: 0 };
const stateOf = (simulation: DebugSimulation) => ({ simulation }) as DebugState;

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getDebugState).mockResolvedValue(stateOf(quiet));
	vi.mocked(setSimulation).mockResolvedValue(stateOf(quiet));
});

const type = (name: string, text: string) => userEvent.type(screen.getByRole("spinbutton", { name }), text);

describe("NetworkSection", () => {
	it("shows the server's simulation", async () => {
		render(<NetworkSection />);
		expect(await screen.findByTestId("network-simulation")).toHaveTextContent('"latencyMs":0');
	});

	it("applies only the fields that were filled in", async () => {
		render(<NetworkSection />);
		expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
		await type("Latency (ms)", "250");
		await type("Error rate (0 to 1)", "0.5");
		await type("Drop after accept (requests)", "1");
		await type("Resolve delay (ms)", "2000");
		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(setSimulation).toHaveBeenCalledWith({
			latencyMs: 250,
			errorRate: 0.5,
			dropAfterAccept: 1,
			resolveDelayMs: 2000
		});
		expect(await screen.findByText("Apply: ok")).toBeInTheDocument();
	});

	it("fails the next requests, optionally for one verb", async () => {
		render(<NetworkSection />);
		await userEvent.click(screen.getByRole("button", { name: "Fail next" }));
		expect(setSimulation).toHaveBeenLastCalledWith({ failNext: { count: 1, status: 500 } });

		await userEvent.selectOptions(screen.getByRole("combobox", { name: "Fail verb" }), "settle");
		await userEvent.clear(screen.getByRole("spinbutton", { name: "Fail status" }));
		await type("Fail status", "503");
		await userEvent.click(screen.getByRole("button", { name: "Fail next" }));
		expect(setSimulation).toHaveBeenLastCalledWith({ failNext: { count: 1, status: 503, verb: "settle" } });
	});

	it("clears every fault", async () => {
		render(<NetworkSection />);
		await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
		expect(setSimulation).toHaveBeenCalledWith(quiet);
	});

	it("shows the server's refusal code", async () => {
		vi.mocked(setSimulation).mockRejectedValue(new ApiError(400, "invalid_debug_request", "bad"));
		render(<NetworkSection />);
		await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
		expect(await screen.findByText("Clear all: invalid_debug_request")).toBeInTheDocument();
	});
});
