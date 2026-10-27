import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorScreen } from "./ErrorScreen";

describe("ErrorScreen", () => {
	it("announces the message as an alert, beside a heading", () => {
		render(<ErrorScreen message="Could not reach the server." onRetry={() => {}} />);
		expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.");
		expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
	});

	it("calls onRetry from a click on Retry", async () => {
		const onRetry = vi.fn();
		render(<ErrorScreen message="Oops" onRetry={onRetry} />);
		await userEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("is reachable and operable from the keyboard", async () => {
		const onRetry = vi.fn();
		render(<ErrorScreen message="Oops" onRetry={onRetry} />);
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
