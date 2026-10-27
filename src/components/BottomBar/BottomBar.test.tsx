import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useBottomBarStore } from "@/stores/bottomBarStore";
import { useSettingsStore } from "@/stores/settingsStore";

import { BottomBar, type BottomBarProps } from "./BottomBar";

const config: BottomBarProps["config"] = {
	minorUnitExponent: 2,
	minWagerMinorUnits: 100,
	maxWagerMinorUnits: 5000,
	wagerStepsMinorUnits: [100, 200, 500, 1000, 5000]
};

function renderBar(props: Partial<BottomBarProps> = {}) {
	const onBetChange = vi.fn();
	const onCtaClick = vi.fn();
	const view = render(
		<BottomBar
			balanceMinorUnits={100005}
			currency="USD"
			config={config}
			betMinorUnits={200}
			onBetChange={onBetChange}
			ctaState="idle"
			onCtaClick={onCtaClick}
			{...props}
		/>
	);
	return { onBetChange, onCtaClick, ...view };
}

beforeEach(() => {
	useBottomBarStore.setState({ menuOpen: false, volumeOpen: false });
	useSettingsStore.setState({ muted: false, volume: 1 });
});

describe("BottomBar", () => {
	it("shows the balance, the bet, the call to action and the menu and audio buttons", () => {
		renderBar();
		expect(screen.getByText("Balance")).toBeInTheDocument();
		expect(screen.getByText("$1,000.05")).toBeInTheDocument();
		expect(screen.getByText("Bet")).toBeInTheDocument();
		expect(screen.getByText("$2.00")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "PLAY" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
	});

	it("formats a currency with no minor unit", () => {
		renderBar({
			balanceMinorUnits: 1500,
			betMinorUnits: 500,
			currency: "JPY",
			config: { ...config, minorUnitExponent: 0 }
		});
		expect(screen.getByText("¥1,500")).toBeInTheDocument();
		expect(screen.getByText("¥500")).toBeInTheDocument();
	});

	it("passes bet changes up", async () => {
		const { onBetChange } = renderBar();
		await userEvent.click(screen.getByRole("button", { name: "Increase bet" }));
		expect(onBetChange).toHaveBeenCalledWith(500);
	});

	it("passes the call to action up", async () => {
		const { onCtaClick } = renderBar();
		await userEvent.click(screen.getByRole("button", { name: "PLAY" }));
		expect(onCtaClick).toHaveBeenCalledOnce();
	});

	it("is inert until a handler is given", async () => {
		renderBar({ onCtaClick: undefined });
		await userEvent.click(screen.getByRole("button", { name: "PLAY" }));
		expect(screen.getByRole("button", { name: "PLAY" })).toBeEnabled();
	});

	it.each([
		["idle", true, true],
		["disabled", false, true],
		["busy", false, false]
	] as const)("ctaState %s: call to action enabled %s, bet adjustable %s", (ctaState, ctaEnabled, betEnabled) => {
		renderBar({ ctaState });
		expect(screen.getByRole("button", { name: "PLAY" }).hasAttribute("disabled")).toBe(!ctaEnabled);
		expect(screen.getByRole("button", { name: "Increase bet" }).hasAttribute("disabled")).toBe(!betEnabled);
	});

	it("opens the menu from the menu button", async () => {
		renderBar();
		await userEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(useBottomBarStore.getState().menuOpen).toBe(true);
	});

	it("keeps every control reachable by name", () => {
		renderBar();
		const names = screen.getAllByRole("button").map(button => button.getAttribute("aria-label") ?? button.textContent);
		expect(names.every(name => name !== null && name !== "")).toBe(true);
	});

	it("has the balance label once", () => {
		const { container } = renderBar();
		expect(within(container).getAllByText("Balance")).toHaveLength(1);
	});
});
