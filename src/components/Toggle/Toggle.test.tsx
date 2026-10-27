import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Toggle } from "./Toggle";

function Controlled({ initial = false }: { initial?: boolean }) {
	const [value, setValue] = useState(initial);
	return <Toggle aria-label="Scroll" value={value} onValueChange={setValue} />;
}

describe("Toggle", () => {
	it("is a switch that reports its state", () => {
		const { rerender } = render(<Toggle aria-label="Scroll" value={false} onValueChange={() => {}} />);
		expect(screen.getByRole("switch", { name: "Scroll", checked: false })).toBeInTheDocument();

		rerender(<Toggle aria-label="Scroll" value onValueChange={() => {}} />);
		expect(screen.getByRole("switch", { name: "Scroll", checked: true })).toBeInTheDocument();
	});

	it("asks for the opposite value when pressed", async () => {
		const onValueChange = vi.fn();
		const { rerender } = render(<Toggle aria-label="Scroll" value={false} onValueChange={onValueChange} />);
		await userEvent.click(screen.getByRole("switch"));
		expect(onValueChange).toHaveBeenLastCalledWith(true);

		rerender(<Toggle aria-label="Scroll" value onValueChange={onValueChange} />);
		await userEvent.click(screen.getByRole("switch"));
		expect(onValueChange).toHaveBeenLastCalledWith(false);
	});

	it("flips with Space and Enter from the keyboard", async () => {
		render(<Controlled />);
		await userEvent.tab();
		expect(screen.getByRole("switch")).toHaveFocus();
		await userEvent.keyboard(" ");
		expect(screen.getByRole("switch", { checked: true })).toBeInTheDocument();
		await userEvent.keyboard("{Enter}");
		expect(screen.getByRole("switch", { checked: false })).toBeInTheDocument();
	});

	it("keeps a caller class", () => {
		render(<Toggle aria-label="Scroll" value onValueChange={() => {}} className="row" />);
		expect(screen.getByRole("switch")).toHaveClass("row");
	});

	it("also calls a caller onClick, and does nothing when disabled", async () => {
		const onClick = vi.fn();
		const onValueChange = vi.fn();
		const { rerender } = render(
			<Toggle aria-label="Scroll" value={false} onValueChange={onValueChange} onClick={onClick} />
		);
		await userEvent.click(screen.getByRole("switch"));
		expect(onClick).toHaveBeenCalledOnce();
		expect(onValueChange).toHaveBeenCalledOnce();

		rerender(<Toggle aria-label="Scroll" value={false} onValueChange={onValueChange} onClick={onClick} disabled />);
		await userEvent.click(screen.getByRole("switch"));
		expect(onClick).toHaveBeenCalledOnce();
		expect(onValueChange).toHaveBeenCalledOnce();
	});
});
