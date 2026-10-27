import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BetInput } from "./BetInput";

const AMOUNTS = [10, 25, 50, 100, 500];

const base = { label: "Bet", increments: AMOUNTS, onValueChange: () => {} };

const decrease = () => screen.getByRole("button", { name: "Decrease bet" });
const increase = () => screen.getByRole("button", { name: "Increase bet" });
const valueButton = () => screen.getByRole("button", { name: /^Bet / });
const popup = () => screen.getByRole("group", { name: "Bet" });

function Controlled({ onChange = () => {} }: { onChange?: (value: number) => void }) {
	const [value, setValue] = useState(25);
	return (
		<>
			<BetInput
				{...base}
				value={value}
				format={amount => `$${amount}`}
				onValueChange={next => {
					onChange(next);
					setValue(next);
				}}
			/>
			<button type="button">outside</button>
		</>
	);
}

describe("BetInput", () => {
	it("shows the label and the formatted value", () => {
		render(<BetInput {...base} value={25} format={amount => `$${amount}`} />);
		expect(screen.getByText("Bet")).toBeInTheDocument();
		expect(screen.getByText("$25")).toBeInTheDocument();
	});

	it("steps to the neighbouring amount in both orientations", async () => {
		const onValueChange = vi.fn();
		const { rerender } = render(<BetInput {...base} value={25} onValueChange={onValueChange} />);
		await userEvent.click(increase());
		expect(onValueChange).toHaveBeenLastCalledWith(50);
		await userEvent.click(decrease());
		expect(onValueChange).toHaveBeenLastCalledWith(10);

		rerender(<BetInput {...base} orientation="vertical" value={100} onValueChange={onValueChange} />);
		await userEvent.click(increase());
		expect(onValueChange).toHaveBeenLastCalledWith(500);
		await userEvent.click(decrease());
		expect(onValueChange).toHaveBeenLastCalledWith(50);
	});

	it("disables the step that has nowhere to go", () => {
		const { rerender } = render(<BetInput {...base} value={10} />);
		expect(decrease()).toBeDisabled();
		expect(increase()).toBeEnabled();

		rerender(<BetInput {...base} value={500} />);
		expect(increase()).toBeDisabled();
		expect(decrease()).toBeEnabled();
	});

	it("steps from a value that is not on offer to the nearest amount on either side, and invents no limit", async () => {
		const onValueChange = vi.fn();
		render(<BetInput {...base} value={30} onValueChange={onValueChange} />);
		await userEvent.click(increase());
		expect(onValueChange).toHaveBeenLastCalledWith(50);
		await userEvent.click(decrease());
		expect(onValueChange).toHaveBeenLastCalledWith(25);
	});

	it("handles values beyond either end of the list", () => {
		const { rerender } = render(<BetInput {...base} value={5} />);
		expect(decrease()).toBeDisabled();
		expect(increase()).toBeEnabled();

		rerender(<BetInput {...base} value={900} />);
		expect(increase()).toBeDisabled();
		expect(decrease()).toBeEnabled();
	});

	it("uses custom step names", () => {
		render(<BetInput {...base} value={25} decrementLabel="Lower stake" incrementLabel="Raise stake" />);
		expect(screen.getByRole("button", { name: "Lower stake" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Raise stake" })).toBeInTheDocument();
	});

	it("opens a quick-select popup listing every amount and marks the current one", async () => {
		render(<BetInput {...base} value={50} format={amount => `$${amount}`} />);
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();

		await userEvent.click(valueButton());
		for (const amount of AMOUNTS) {
			expect(within(popup()).getByRole("button", { name: `$${amount}` })).toBeInTheDocument();
		}
		expect(within(popup()).getByRole("button", { name: "$50", pressed: true })).toBeInTheDocument();
		expect(valueButton()).toHaveAttribute("aria-expanded", "true");
	});

	it("moves focus into the popup on the current amount and back on close", async () => {
		render(<BetInput {...base} value={50} format={amount => `$${amount}`} />);
		await userEvent.click(valueButton());
		expect(within(popup()).getByRole("button", { name: "$50" })).toHaveFocus();

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
		expect(valueButton()).toHaveFocus();
	});

	it("picks an amount from the popup and closes it", async () => {
		const onChange = vi.fn();
		render(<Controlled onChange={onChange} />);
		await userEvent.click(valueButton());
		await userEvent.click(within(popup()).getByRole("button", { name: "$100" }));
		expect(onChange).toHaveBeenCalledWith(100);
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
		expect(screen.getByText("$100")).toBeInTheDocument();
	});

	it("closes the popup from its close button, on Escape and on an outside press", async () => {
		render(<Controlled />);

		await userEvent.click(valueButton());
		await userEvent.click(within(popup()).getByRole("button", { name: "Close" }));
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();

		await userEvent.click(valueButton());
		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();

		await userEvent.click(valueButton());
		await userEvent.click(screen.getByRole("button", { name: "outside" }));
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
	});

	it("keeps the popup open for presses inside it and toggles it from the value button", async () => {
		render(<Controlled />);
		await userEvent.click(valueButton());
		await userEvent.click(within(popup()).getByText("Bet"));
		expect(popup()).toBeInTheDocument();

		await userEvent.click(valueButton());
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
	});

	it("when disabled: no steps, no popup, and an open popup does not return when re-enabled", async () => {
		const { rerender } = render(<BetInput {...base} value={50} />);
		await userEvent.click(valueButton());
		expect(popup()).toBeInTheDocument();

		rerender(<BetInput {...base} value={50} disabled />);
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
		expect(decrease()).toBeDisabled();
		expect(increase()).toBeDisabled();
		expect(screen.queryByRole("button", { name: /^Bet / })).not.toBeInTheDocument();

		rerender(<BetInput {...base} value={50} />);
		expect(screen.queryByRole("group", { name: "Bet" })).not.toBeInTheDocument();
	});

	it("works without a label", async () => {
		render(<BetInput increments={AMOUNTS} value={50} onValueChange={() => {}} />);
		await userEvent.click(screen.getByRole("button", { name: "50" }));
		expect(screen.getByRole("group", { name: "Amounts" })).toBeInTheDocument();
	});

	it("keeps a caller class and passes other attributes to its root", () => {
		render(<BetInput {...base} value={50} className="slot" data-testid="bet" />);
		expect(screen.getByTestId("bet")).toHaveClass("slot");
		expect(screen.getByTestId("bet")).toHaveAttribute("data-orientation", "horizontal");
	});
});
