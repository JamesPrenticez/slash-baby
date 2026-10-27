import { render, screen } from "@testing-library/react";

import { BalanceSection } from "./BalanceSection";

describe("BalanceSection", () => {
	it("labels the balance and shows it through formatMoney", () => {
		render(<BalanceSection balanceMinorUnits={100005} currency="USD" config={{ minorUnitExponent: 2 }} />);
		expect(screen.getByText("Balance")).toBeInTheDocument();
		expect(screen.getByText("$1,000.05")).toBeInTheDocument();
	});

	it("formats a currency with no minor unit (JPY)", () => {
		render(<BalanceSection balanceMinorUnits={1500} currency="JPY" config={{ minorUnitExponent: 0 }} />);
		expect(screen.getByText("¥1,500")).toBeInTheDocument();
	});

	it("shows an empty balance as zero, not as nothing", () => {
		render(<BalanceSection balanceMinorUnits={0} currency="USD" config={{ minorUnitExponent: 2 }} />);
		expect(screen.getByText("$0.00")).toBeInTheDocument();
	});

	it("ties the amount to its label", () => {
		render(<BalanceSection balanceMinorUnits={250} currency="USD" config={{ minorUnitExponent: 2 }} />);
		expect(screen.getByRole("term")).toHaveTextContent("Balance");
		expect(screen.getByRole("definition")).toHaveTextContent("$2.50");
	});
});
