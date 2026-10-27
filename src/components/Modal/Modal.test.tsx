import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Modal } from "./Modal";

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open
			</button>
			<Modal
				open={open}
				title="BET HISTORY"
				subtitle="Your last rounds"
				onClose={() => {
					onClose();
					setOpen(false);
				}}
			>
				<button type="button">Load more</button>
			</Modal>
		</>
	);
}

describe("Modal", () => {
	it("renders nothing while closed", () => {
		render(
			<Modal open={false} title="Menu" onClose={() => {}}>
				<p>body</p>
			</Modal>
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.queryByText("body")).not.toBeInTheDocument();
	});

	it("is a modal dialog named by its title, with subtitle and content", () => {
		render(
			<Modal open title="Menu" subtitle="Settings" onClose={() => {}}>
				<p>body</p>
			</Modal>
		);
		const dialog = screen.getByRole("dialog", { name: "Menu" });
		expect(dialog).toHaveAttribute("aria-modal", "true");
		expect(screen.getByRole("heading", { level: 2, name: "Menu" })).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(dialog).toContainElement(screen.getByText("body"));
	});

	it("closes from the close button", async () => {
		const onClose = vi.fn();
		render(<Modal open title="Menu" onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("closes on Escape", async () => {
		const onClose = vi.fn();
		render(<Modal open title="Menu" onClose={onClose} />);
		await userEvent.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("still closes on Escape after the focused control disappears", async () => {
		const onClose = vi.fn();
		function Vanishing() {
			const [shown, setShown] = useState(true);
			return (
				<Modal open title="Menu" onClose={onClose}>
					{shown && (
						<button type="button" onClick={() => setShown(false)}>
							Load more
						</button>
					)}
				</Modal>
			);
		}
		render(<Vanishing />);
		await userEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(document.body).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("closes on a click on the backdrop but not on the panel", async () => {
		const onClose = vi.fn();
		render(
			<Modal open title="Menu" onClose={onClose}>
				<p>body</p>
			</Modal>
		);
		await userEvent.click(screen.getByText("body"));
		await userEvent.click(screen.getByRole("dialog"));
		expect(onClose).not.toHaveBeenCalled();

		const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
		await userEvent.click(backdrop);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("only the topmost of two stacked modals closes on Escape", async () => {
		const outer = vi.fn();
		const inner = vi.fn();
		function Stacked() {
			const [innerOpen, setInnerOpen] = useState(false);
			return (
				<Modal open title="Outer" onClose={outer}>
					<button type="button" onClick={() => setInnerOpen(true)}>
						Open inner
					</button>
					<Modal
						open={innerOpen}
						title="Inner"
						onClose={() => {
							inner();
							setInnerOpen(false);
						}}
					/>
				</Modal>
			);
		}
		render(<Stacked />);
		await userEvent.click(screen.getByRole("button", { name: "Open inner" }));
		await userEvent.keyboard("{Escape}");
		expect(inner).toHaveBeenCalledOnce();
		expect(outer).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Open inner" })).toHaveFocus();
	});

	it("moves focus in on open, traps Tab, and returns focus to the opener on close", async () => {
		render(<Harness />);
		const opener = screen.getByRole("button", { name: "Open" });
		await userEvent.click(opener);

		expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Load more" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
		await userEvent.tab({ shift: true });
		expect(screen.getByRole("button", { name: "Load more" })).toHaveFocus();

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(opener).toHaveFocus();
	});

	it("dims the page behind only when asked", () => {
		const { rerender } = render(<Modal open title="Menu" onClose={() => {}} />);
		const backdrop = () => screen.getByRole("dialog").parentElement as HTMLElement;
		expect(backdrop()).not.toHaveAttribute("data-dimmed");

		rerender(<Modal open dimmed title="Menu" onClose={() => {}} />);
		expect(backdrop()).toHaveAttribute("data-dimmed");
	});

	it("puts a caller class on the panel", () => {
		render(<Modal open title="Menu" className="wide" onClose={() => {}} />);
		expect(screen.getByRole("dialog")).toHaveClass("wide");
	});
});
