import { render, screen, within } from "@testing-library/react";

import type { HistoryEntry } from "@/types/round";

import { RoundHistory } from "./RoundHistory";

const entry = (n: number, overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
	roundId: `round-${n}`,
	createdAt: "2026-10-25T10:00:00Z",
	settledAt: "2026-10-25T10:00:30Z",
	wagerMinorUnits: 100,
	payoutMinorUnits: 250,
	currency: "USD",
	category: "small_win",
	...overrides
});

const pills = () => within(screen.getByRole("list", { name: "Recent rounds" })).getAllByRole("listitem");

describe("RoundHistory", () => {
	it("renders nothing when there are no entries", () => {
		const { container } = render(<RoundHistory entries={[]} minorUnitExponent={2} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows each payout through formatMoney with the currency's exponent", () => {
		const { rerender } = render(
			<RoundHistory entries={[entry(1, { payoutMinorUnits: 12345 })]} minorUnitExponent={2} />
		);
		expect(pills()[0]).toHaveTextContent("$123.45");

		rerender(<RoundHistory entries={[entry(1, { payoutMinorUnits: 1500, currency: "JPY" })]} minorUnitExponent={0} />);
		expect(pills()[0]).toHaveTextContent("¥1,500");
	});

	it("keeps the server's newest-first order and shows only the six newest", () => {
		const entries = [1, 2, 3, 4, 5, 6, 7, 8].map(n => entry(n, { payoutMinorUnits: n * 100 }));
		render(<RoundHistory entries={entries} minorUnitExponent={2} />);

		expect(pills().map(pill => pill.textContent)).toEqual(["$1.00", "$2.00", "$3.00", "$4.00", "$5.00", "$6.00"]);
	});

	it("flags a loss and shows its zero payout", () => {
		render(
			<RoundHistory
				entries={[entry(1, { category: "loss", payoutMinorUnits: 0 }), entry(2, { category: "big_win" })]}
				minorUnitExponent={2}
			/>
		);

		const [loss, win] = pills();
		expect(loss).toHaveTextContent("$0.00");
		expect(loss).toHaveAttribute("data-category", "loss");
		expect(win).toHaveAttribute("data-category", "big_win");
	});
});
