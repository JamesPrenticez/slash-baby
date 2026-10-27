import { useEffect } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Pixi needs WebGL, which happy-dom lacks. The stand-in shows what App hands the canvas and counts its mounts.
const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/GameCanvas", () => ({
	GameCanvas: ({ running, animation, speedMultiplier }: Record<string, unknown>) => {
		useEffect(() => {
			mounts.count += 1;
		}, []);
		return (
			<div
				data-testid="canvas"
				data-running={String(running)}
				data-animation={String(animation)}
				data-speed={String(speedMultiplier)}
			/>
		);
	}
}));

// The session boot is covered by App.test.tsx; here it is simply done, and the UI over the canvas is out of scope.
vi.mock("@/hooks/useGameSession", () => ({ useGameSession: () => ({ status: "ready", retry: () => {} }) }));
vi.mock("@/components/UserInterface", () => ({ UserInterface: () => null }));
vi.mock("@/api/debug", () => ({
	getDebugState: vi.fn(() => new Promise(() => {})),
	getDebugPlayerId: () => "tester-test"
}));

// App reads the gate when it is imported, so each test sets the flag and imports App and the probe afresh.
const load = async (flag: string) => {
	vi.stubEnv("VITE_DEBUG", flag);
	vi.resetModules();
	const { default: App } = await import("@/App");
	const { probe } = await import("@/utils/debugProbe");
	return { App, probe };
};

describe("App and the debug gate", () => {
	beforeEach(() => {
		mounts.count = 0;
	});
	afterEach(() => vi.unstubAllEnvs());

	it("has no debug menu and counts no commits with the flag off", async () => {
		const { App, probe } = await load("");
		render(<App />);

		await new Promise(resolve => setTimeout(resolve, 50));
		expect(screen.queryByRole("button", { name: "Debug" })).not.toBeInTheDocument();
		expect(screen.getByTestId("canvas")).toBeInTheDocument();
		expect(probe.commits).toBe(0);
	});

	it("loads the menu on demand and lets it drive the canvas with the flag on", async () => {
		const { App } = await load("true");
		render(<App />);

		await userEvent.click(await screen.findByRole("button", { name: "Debug" }, { timeout: 15_000 }));
		const menu = screen.getByRole("region", { name: "Debug menu" });
		const canvas = screen.getByTestId("canvas");
		expect(canvas).toHaveAttribute("data-animation", "undefined");

		await userEvent.click(within(menu).getByRole("button", { name: "jump" }));
		await waitFor(() => expect(canvas).toHaveAttribute("data-animation", "jump"));

		await userEvent.selectOptions(within(menu).getByRole("combobox", { name: "Speed" }), "4");
		await waitFor(() => expect(canvas).toHaveAttribute("data-speed", "4"));

		await userEvent.click(within(menu).getByRole("button", { name: /^Run$/ }));
		expect(canvas).toHaveAttribute("data-running", "true");
	}, 30_000);

	it("remounts the canvas from the menu and nothing else", async () => {
		const { App } = await load("true");
		render(<App />);
		await userEvent.click(await screen.findByRole("button", { name: "Debug" }, { timeout: 15_000 }));
		expect(mounts.count).toBe(1);

		await userEvent.click(screen.getByRole("button", { name: "Remount canvas" }));
		await waitFor(() => expect(mounts.count).toBe(2));
	}, 30_000);
});
