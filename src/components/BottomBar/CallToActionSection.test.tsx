import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CallToActionSection } from "./CallToActionSection";

const button = () => screen.getByRole("button", { name: "PLAY" });

describe("CallToActionSection", () => {
	it("is a usable button when idle", async () => {
		const onClick = vi.fn();
		render(<CallToActionSection state="idle" onClick={onClick} />);
		expect(button()).toBeEnabled();
		await userEvent.click(button());
		expect(onClick).toHaveBeenCalledOnce();
	});

	it.each(["busy", "disabled"] as const)("cannot be pressed when %s", async state => {
		const onClick = vi.fn();
		render(<CallToActionSection state={state} onClick={onClick} />);
		expect(button()).toBeDisabled();
		await userEvent.click(button());
		expect(onClick).not.toHaveBeenCalled();
	});

	it("tells assistive tech only when it is busy", () => {
		const { rerender } = render(<CallToActionSection state="busy" />);
		expect(button()).toHaveAttribute("aria-busy", "true");
		rerender(<CallToActionSection state="disabled" />);
		expect(button()).not.toHaveAttribute("aria-busy");
	});

	it("does nothing when no handler is given (inert until a round can start)", async () => {
		render(<CallToActionSection state="idle" />);
		await userEvent.click(button());
		expect(button()).toBeEnabled();
	});
});
