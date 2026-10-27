import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { type BetConfig, BetSection } from "./BetSection";

const config: BetConfig = {
	minorUnitExponent: 2,
	minWagerMinorUnits: 100,
	maxWagerMinorUnits: 5000,
	wagerStepsMinorUnits: [50, 100, 200, 500, 1000, 5000, 10000]
};

/** Phone layouts render the horizontal stepper, tablet and desktop landscape the vertical one. */
function stubViewport(tabletLandscape: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: tabletLandscape,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {}
	}));
}

const decrease = () => screen.getByRole("button", { name: "Decrease bet" });
const increase = () => screen.getByRole("button", { name: "Increase bet" });

function renderBet(props: Partial<React.ComponentProps<typeof BetSection>> = {}) {
	const onBetChange = vi.fn();
	const view = render(
		<BetSection betMinorUnits={200} currency="USD" config={config} busy={false} onBetChange={onBetChange} {...props} />
	);
	return { onBetChange, ...view };
}

beforeEach(() => stubViewport(false));
afterEach(() => vi.unstubAllGlobals());

describe("BetSection", () => {
	it("shows the bet through formatMoney, labelled", () => {
		renderBet({ betMinorUnits: 200 });
		expect(screen.getByText("Bet")).toBeInTheDocument();
		expect(screen.getByText("$2.00")).toBeInTheDocument();
	});

	it("formats in the config's exponent (JPY has none)", () => {
		renderBet({ betMinorUnits: 500, currency: "JPY", config: { ...config, minorUnitExponent: 0 } });
		expect(screen.getByText("¥500")).toBeInTheDocument();
	});

	it("steps to the neighbouring amounts, in both layouts", async () => {
		const { onBetChange, unmount } = renderBet({ betMinorUnits: 200 });
		await userEvent.click(increase());
		expect(onBetChange).toHaveBeenLastCalledWith(500);
		await userEvent.click(decrease());
		expect(onBetChange).toHaveBeenLastCalledWith(100);
		unmount();

		stubViewport(true);
		const vertical = renderBet({ betMinorUnits: 200 });
		await userEvent.click(increase());
		expect(vertical.onBetChange).toHaveBeenLastCalledWith(500);
		expect(document.querySelector('[data-orientation="vertical"]')).not.toBeNull();
	});

	it("uses the horizontal stepper on phones", () => {
		renderBet();
		expect(document.querySelector('[data-orientation="horizontal"]')).not.toBeNull();
	});

	it("offers only the steps inside min and max", async () => {
		renderBet({ betMinorUnits: 100 });
		await userEvent.click(screen.getByRole("button", { name: /^Bet / }));
		const amounts = screen
			.getAllByRole("button")
			.map(node => node.textContent)
			.filter(text => text?.startsWith("$"));
		expect(amounts).toEqual(expect.arrayContaining(["$1.00", "$2.00", "$5.00", "$10.00", "$50.00"]));
		expect(amounts).not.toContain("$0.50");
		expect(amounts).not.toContain("$100.00");
	});

	it("cannot step below the minimum or above the maximum", () => {
		const { rerender, onBetChange } = renderBet({ betMinorUnits: 100 });
		expect(decrease()).toBeDisabled();
		rerender(<BetSection betMinorUnits={5000} currency="USD" config={config} busy={false} onBetChange={onBetChange} />);
		expect(increase()).toBeDisabled();
	});

	it("clamps a bet that is out of range, in what it shows and in what the parent holds", () => {
		const { onBetChange } = renderBet({ betMinorUnits: 99999 });
		expect(screen.getByText("$50.00")).toBeInTheDocument();
		expect(onBetChange).toHaveBeenCalledExactlyOnceWith(5000);
	});

	it("clamps up to the minimum", () => {
		const { onBetChange } = renderBet({ betMinorUnits: 1 });
		expect(screen.getByText("$1.00")).toBeInTheDocument();
		expect(onBetChange).toHaveBeenCalledExactlyOnceWith(100);
	});

	it("does not touch a bet that is already in range", () => {
		const { onBetChange } = renderBet({ betMinorUnits: 1000 });
		expect(onBetChange).not.toHaveBeenCalled();
	});

	it("re-clamps when the limits change under it (a currency switch)", () => {
		function Parent() {
			const [bet, setBet] = useState(1000);
			const [limits, setLimits] = useState(config);
			return (
				<>
					<BetSection betMinorUnits={bet} currency="USD" config={limits} busy={false} onBetChange={setBet} />
					<button type="button" onClick={() => setLimits({ ...config, maxWagerMinorUnits: 500 })}>
						tighten
					</button>
				</>
			);
		}
		render(<Parent />);
		expect(screen.getByText("$10.00")).toBeInTheDocument();
		return userEvent.click(screen.getByRole("button", { name: "tighten" })).then(() => {
			expect(screen.getByText("$5.00")).toBeInTheDocument();
		});
	});

	it("is locked while busy", () => {
		renderBet({ busy: true });
		expect(decrease()).toBeDisabled();
		expect(increase()).toBeDisabled();
		expect(screen.queryByRole("button", { name: /^Bet / })).toBeNull();
	});
});
