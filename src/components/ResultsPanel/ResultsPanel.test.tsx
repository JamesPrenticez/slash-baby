import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ResultsPanel, type ResultsPanelProps } from "./ResultsPanel";

const props = (over: Partial<ResultsPanelProps> = {}): ResultsPanelProps => ({
	payoutMinorUnits: 150,
	category: "small_win",
	balanceMinorUnits: 100050,
	currency: "USD",
	minorUnitExponent: 2,
	onContinue: () => {},
	...over
});

describe("ResultsPanel", () => {
	it("shows the server's category, payout and balance in the player's currency", () => {
		render(<ResultsPanel {...props()} />);
		expect(screen.getByRole("dialog", { name: "Small win" })).toBeInTheDocument();
		expect(screen.getByText("$1.50")).toBeInTheDocument();
		expect(screen.getByText("$1,000.50")).toBeInTheDocument();
	});

	it("shows a zero payout as money, with no win or loss wording", () => {
		render(<ResultsPanel {...props({ payoutMinorUnits: 0, category: "loss" })} />);
		expect(screen.getByRole("dialog", { name: "Loss" })).toBeInTheDocument();
		expect(screen.getByText("$0.00")).toBeInTheDocument();
		expect(screen.queryByText(/you (won|lost)/i)).not.toBeInTheDocument();
	});

	it("formats an exponent-0 currency without decimals", () => {
		render(<ResultsPanel {...props({ currency: "JPY", minorUnitExponent: 0, payoutMinorUnits: 1500 })} />);
		expect(screen.getByText("¥1,500")).toBeInTheDocument();
	});

	it("has one Continue button, focused, and calls onContinue from it", async () => {
		const onContinue = vi.fn();
		render(<ResultsPanel {...props({ onContinue })} />);
		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0]).toHaveTextContent("Continue");
		expect(buttons[0]).toHaveFocus();
		await userEvent.click(buttons[0]);
		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("is not closed by Escape or a click outside", async () => {
		const onContinue = vi.fn();
		render(<ResultsPanel {...props({ onContinue })} />);
		await userEvent.keyboard("{Escape}");
		await userEvent.click(screen.getByRole("dialog").parentElement!);
		expect(onContinue).not.toHaveBeenCalled();
	});
});
