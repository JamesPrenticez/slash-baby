import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IconButton } from "./IconButton";

const icon = <svg data-testid="icon" />;

describe("IconButton", () => {
	it("is named by aria-label and shows its icon", () => {
		render(<IconButton aria-label="Menu">{icon}</IconButton>);
		expect(screen.getByRole("button", { name: "Menu" })).toContainElement(screen.getByTestId("icon"));
	});

	it("does not claim to be a toggle unless active is given", () => {
		const { rerender } = render(<IconButton aria-label="Menu">{icon}</IconButton>);
		expect(screen.getByRole("button", { name: "Menu" })).not.toHaveAttribute("aria-pressed");

		rerender(
			<IconButton aria-label="Menu" active>
				{icon}
			</IconButton>
		);
		expect(screen.getByRole("button", { name: "Menu", pressed: true })).toBeInTheDocument();

		rerender(
			<IconButton aria-label="Menu" active={false}>
				{icon}
			</IconButton>
		);
		expect(screen.getByRole("button", { name: "Menu", pressed: false })).toBeInTheDocument();
	});

	it("is operable by pointer and keyboard, and inert when disabled", async () => {
		const onClick = vi.fn();
		const { rerender } = render(
			<IconButton aria-label="Menu" onClick={onClick}>
				{icon}
			</IconButton>
		);
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await userEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(onClick).toHaveBeenCalledTimes(2);

		rerender(
			<IconButton aria-label="Menu" onClick={onClick} disabled>
				{icon}
			</IconButton>
		);
		await userEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("passes data attributes and class names through", () => {
		render(
			<IconButton aria-label="Menu" className="layout" data-menu-toggle>
				{icon}
			</IconButton>
		);
		const button = screen.getByRole("button", { name: "Menu" });
		expect(button).toHaveClass("layout");
		expect(button).toHaveAttribute("data-menu-toggle");
	});
});
