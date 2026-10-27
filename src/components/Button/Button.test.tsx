import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "./Button";

describe("Button", () => {
	it("renders a non-submitting button with the primary variant by default", () => {
		render(<Button>Bet</Button>);
		const button = screen.getByRole("button", { name: "Bet" });
		expect(button).toHaveAttribute("type", "button");
		expect(button).toHaveAttribute("data-variant", "primary");
	});

	it.each(["secondary", "negative", "outline"] as const)("marks the %s variant", variant => {
		render(<Button variant={variant}>Go</Button>);
		expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("data-variant", variant);
	});

	it("calls onClick, and not when disabled", async () => {
		const onClick = vi.fn();
		const { rerender } = render(<Button onClick={onClick}>Go</Button>);
		await userEvent.click(screen.getByRole("button", { name: "Go" }));
		expect(onClick).toHaveBeenCalledOnce();

		rerender(
			<Button onClick={onClick} disabled>
				Go
			</Button>
		);
		await userEvent.click(screen.getByRole("button", { name: "Go" }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("is reachable and operable from the keyboard", async () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Go</Button>);
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Go" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard(" ");
		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("keeps its own class when given one, and lets type be overridden", () => {
		render(
			<Button className="layout" type="submit">
				Go
			</Button>
		);
		const button = screen.getByRole("button", { name: "Go" });
		expect(button).toHaveClass("layout");
		expect(button.className).toContain("button");
		expect(button).toHaveAttribute("type", "submit");
	});

	it("forwards a ref", () => {
		let node: HTMLButtonElement | null = null;
		render(
			<Button
				ref={element => {
					node = element;
				}}
			>
				Go
			</Button>
		);
		expect(node).toBe(screen.getByRole("button", { name: "Go" }));
	});
});
