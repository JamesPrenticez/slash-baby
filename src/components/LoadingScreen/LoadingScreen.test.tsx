import { render, screen } from "@testing-library/react";

import { LoadingScreen } from "./LoadingScreen";

describe("LoadingScreen", () => {
	it("shows the title and a progressbar", () => {
		render(<LoadingScreen progress={0} />);
		expect(screen.getByText("Slash Baby")).toBeInTheDocument();
		expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
		expect(screen.getByText("0%")).toBeInTheDocument();
	});

	it("reports a 0 to 1 progress as a rounded percentage on the label, the bar and its fill", () => {
		render(<LoadingScreen progress={0.456} />);
		const bar = screen.getByRole("progressbar");
		expect(screen.getByText("46%")).toBeInTheDocument();
		expect(bar).toHaveAttribute("aria-valuenow", "46");
		expect(bar).toHaveAttribute("aria-valuemin", "0");
		expect(bar).toHaveAttribute("aria-valuemax", "100");
		expect(bar.firstElementChild).toHaveStyle({ width: "46%" });
	});

	it.each([
		[-0.5, "0"],
		[1, "100"],
		[1.7, "100"]
	])("clamps progress %s to %s%%", (progress, percent) => {
		render(<LoadingScreen progress={progress} />);
		expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", percent);
		expect(screen.getByText(`${percent}%`)).toBeInTheDocument();
	});

	it("is indeterminate without a progress: no value, no percentage", () => {
		render(<LoadingScreen />);
		const bar = screen.getByRole("progressbar", { name: "Loading" });
		expect(bar).not.toHaveAttribute("aria-valuenow");
		expect(bar).toHaveAttribute("data-indeterminate");
		expect(screen.queryByText(/%/)).not.toBeInTheDocument();
	});
});
