import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CloseButton } from "./CloseButton";

describe("CloseButton", () => {
	it("is named Close by default, with a decorative icon", () => {
		render(<CloseButton />);
		const button = screen.getByRole("button", { name: "Close" });
		expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
	});

	it("accepts a more specific name", () => {
		render(<CloseButton aria-label="Close bet history" />);
		expect(screen.getByRole("button", { name: "Close bet history" })).toBeInTheDocument();
	});

	it("keeps a caller class", () => {
		render(<CloseButton className="corner" />);
		expect(screen.getByRole("button", { name: "Close" })).toHaveClass("corner");
	});

	it("calls onClick from pointer and keyboard", async () => {
		const onClick = vi.fn();
		render(<CloseButton onClick={onClick} />);
		await userEvent.tab();
		await userEvent.keyboard("{Enter}");
		await userEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onClick).toHaveBeenCalledTimes(2);
	});
});
