import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Slider } from "./Slider";

describe("Slider", () => {
	it("is a labelled range from 0 to 1 showing its value", () => {
		render(<Slider aria-label="Effects" value={0.4} onValueChange={() => {}} />);
		const slider = screen.getByRole("slider", { name: "Effects" });
		expect(slider).toHaveAttribute("min", "0");
		expect(slider).toHaveAttribute("max", "1");
		expect(slider).toHaveValue("0.4");
	});

	it("reports the new value as a number", () => {
		const onValueChange = vi.fn();
		render(<Slider aria-label="Effects" value={0.4} onValueChange={onValueChange} />);
		fireEvent.change(screen.getByRole("slider"), { target: { value: "0.75" } });
		expect(onValueChange).toHaveBeenCalledWith(0.75);
	});

	it("drives the fill from the value and clamps it to the track", () => {
		const { container, rerender } = render(<Slider aria-label="Effects" value={0.25} onValueChange={() => {}} />);
		const root = container.firstElementChild as HTMLElement;
		expect(root.style.getPropertyValue("--slider-fill")).toBe("25%");

		rerender(<Slider aria-label="Effects" value={3} onValueChange={() => {}} />);
		expect(root.style.getPropertyValue("--slider-fill")).toBe("100%");

		rerender(<Slider aria-label="Effects" value={-1} onValueChange={() => {}} />);
		expect(root.style.getPropertyValue("--slider-fill")).toBe("0%");
	});

	it("is reachable by Tab, passes tabIndex through to the input and puts className on the wrapper", async () => {
		const { container } = render(
			<Slider aria-label="Effects" value={0.5} onValueChange={() => {}} className="row" tabIndex={0} />
		);
		expect(container.firstElementChild).toHaveClass("row");
		expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "0");
		await userEvent.tab();
		expect(screen.getByRole("slider")).toHaveFocus();
	});

	it("cannot be changed while disabled", () => {
		render(<Slider aria-label="Effects" value={0.5} onValueChange={() => {}} disabled />);
		expect(screen.getByRole("slider")).toBeDisabled();
	});
});
