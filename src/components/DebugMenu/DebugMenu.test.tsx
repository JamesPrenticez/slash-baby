import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useDebugStore } from "@/stores/debugStore";
import { probe, resetProbe } from "@/utils/debugProbe";

import { DebugMenu } from "./DebugMenu";

// The session section talks to the server; these tests are about the menu shell.
vi.mock("@/api/debug", () => ({
	getDebugState: vi.fn(() => new Promise(() => {})),
	getDebugPlayerId: () => "tester-test"
}));

const setup = (props: Partial<Parameters<typeof DebugMenu>[0]> = {}) => {
	const onRunningChange = vi.fn();
	const onControls = vi.fn();
	render(<DebugMenu running={false} onRunningChange={onRunningChange} onControls={onControls} {...props} />);
	return { onRunningChange, onControls };
};

const openMenu = () => userEvent.click(screen.getByRole("button", { name: "Debug" }));
const panel = () => screen.getByRole("region", { name: "Debug menu" });

describe("DebugMenu", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_DEBUG", "true");
		useDebugStore.setState(useDebugStore.getInitialState(), true);
		resetProbe();
	});
	afterEach(() => vi.unstubAllEnvs());

	it("renders nothing when the debug flag is off", () => {
		vi.stubEnv("VITE_DEBUG", "");
		const { container } = render(<DebugMenu running={false} onRunningChange={vi.fn()} onControls={vi.fn()} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows only the toggle until it is pressed", async () => {
		setup();
		const toggle = screen.getByRole("button", { name: "Debug" });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("region")).not.toBeInTheDocument();

		await userEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(toggle).toHaveAttribute("aria-controls", panel().id);

		await userEvent.click(toggle);
		expect(screen.queryByRole("region")).not.toBeInTheDocument();
	});

	it("reports the starting controls on mount", () => {
		const { onControls } = setup();
		expect(onControls).toHaveBeenLastCalledWith({ animation: undefined, speedMultiplier: 1, canvasKey: 0 });
	});

	it("starts the run when it is standing, and stops it when it is running", async () => {
		const { onRunningChange } = setup();
		await openMenu();
		await userEvent.click(within(panel()).getByRole("button", { name: /^Run$/ }));
		expect(onRunningChange).toHaveBeenLastCalledWith(true);
	});

	it("offers Stop while running", async () => {
		const { onRunningChange } = setup({ running: true });
		await openMenu();
		await userEvent.click(within(panel()).getByRole("button", { name: "Stop" }));
		expect(onRunningChange).toHaveBeenLastCalledWith(false);
		expect(within(panel()).queryByRole("button", { name: /^Run$/ })).not.toBeInTheDocument();
	});

	it("lists the six animations plus automatic, with automatic selected", async () => {
		setup();
		await openMenu();
		const group = within(panel()).getByRole("group", { name: "Animation" });
		expect(
			within(group)
				.getAllByRole("button")
				.map(button => button.textContent)
		).toEqual(["auto", "idle", "run", "jump", "hit", "die", "attack"]);
		expect(within(group).getByRole("button", { name: "auto" })).toHaveAttribute("aria-pressed", "true");
	});

	it("forces an animation and hands it back to automatic", async () => {
		const { onControls } = setup();
		await openMenu();
		const group = within(panel()).getByRole("group", { name: "Animation" });

		await userEvent.click(within(group).getByRole("button", { name: "die" }));
		expect(onControls).toHaveBeenLastCalledWith(expect.objectContaining({ animation: "die" }));
		expect(within(group).getByRole("button", { name: "die" })).toHaveAttribute("aria-pressed", "true");
		expect(within(group).getByRole("button", { name: "auto" })).toHaveAttribute("aria-pressed", "false");

		await userEvent.click(within(group).getByRole("button", { name: "auto" }));
		expect(onControls).toHaveBeenLastCalledWith(expect.objectContaining({ animation: undefined }));
	});

	it("sets the speed multiplier", async () => {
		const { onControls } = setup();
		await openMenu();
		const speed = within(panel()).getByRole("combobox", { name: "Speed" });
		expect(speed).toHaveValue("1");

		await userEvent.selectOptions(speed, "2");
		expect(onControls).toHaveBeenLastCalledWith(expect.objectContaining({ speedMultiplier: 2 }));
	});

	it("remounts the canvas by changing its key", async () => {
		const { onControls } = setup();
		await openMenu();
		await userEvent.click(within(panel()).getByRole("button", { name: "Remount canvas" }));
		expect(onControls).toHaveBeenLastCalledWith(expect.objectContaining({ canvasKey: 1 }));
		await userEvent.click(within(panel()).getByRole("button", { name: "Remount canvas" }));
		expect(onControls).toHaveBeenLastCalledWith(expect.objectContaining({ canvasKey: 2 }));
	});

	it("shows the readouts, filled from the probe", async () => {
		probe.commits = 3;
		setup();
		await openMenu();
		const commits = within(panel()).getByText("React commits");
		expect(commits.nextElementSibling).toHaveTextContent("3");
	});
});
