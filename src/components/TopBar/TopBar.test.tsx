import { render, screen } from "@testing-library/react";

import { TopBar } from "./TopBar";

describe("TopBar", () => {
	it("shows the balance", () => {
		render(<TopBar balanceMinorUnits={100005} currency="USD" config={{ minorUnitExponent: 2 }} />);
		expect(screen.getByText("Balance")).toBeInTheDocument();
		expect(screen.getByText("$1,000.05")).toBeInTheDocument();
	});

	it("formats a currency with no minor unit", () => {
		render(<TopBar balanceMinorUnits={1500} currency="JPY" config={{ minorUnitExponent: 0 }} />);
		expect(screen.getByText("¥1,500")).toBeInTheDocument();
	});

	it("has nothing to press, so it never takes a tap from the canvas", () => {
		render(<TopBar balanceMinorUnits={0} currency="USD" config={{ minorUnitExponent: 2 }} />);
		expect(screen.queryAllByRole("button")).toHaveLength(0);
	});
});
