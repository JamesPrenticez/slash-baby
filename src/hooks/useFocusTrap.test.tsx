import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useFocusTrap } from "./useFocusTrap";

function Trap({ children }: { children?: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	useFocusTrap(ref);
	return (
		<div ref={ref} tabIndex={-1} data-testid="trap">
			{children}
		</div>
	);
}

function Toggle() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(value => !value)}>
				opener
			</button>
			{open && (
				<Trap>
					<button type="button" onClick={() => setOpen(false)}>
						first
					</button>
					<button type="button">last</button>
				</Trap>
			)}
		</>
	);
}

describe("useFocusTrap", () => {
	it("moves focus to the first control on activation", () => {
		render(
			<>
				<button type="button">page</button>
				<Trap>
					<button type="button">first</button>
					<button type="button">last</button>
				</Trap>
			</>
		);
		expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
	});

	it("falls back to the element itself when nothing inside takes focus", () => {
		render(<Trap />);
		expect(screen.getByTestId("trap")).toHaveFocus();
	});

	it("wraps Tab from the last control to the first and Shift+Tab the other way", async () => {
		render(
			<>
				<button type="button">page</button>
				<Trap>
					<button type="button">first</button>
					<button type="button">last</button>
				</Trap>
			</>
		);
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
		await userEvent.tab({ shift: true });
		expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
	});

	it("pulls focus back in when it was outside", async () => {
		render(
			<>
				<button type="button">page</button>
				<Trap>
					<button type="button">first</button>
				</Trap>
			</>
		);
		screen.getByRole("button", { name: "page" }).focus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
	});

	it("returns focus to the opener when it deactivates", async () => {
		render(<Toggle />);
		const opener = screen.getByRole("button", { name: "opener" });
		await userEvent.click(opener);
		expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
		await userEvent.click(screen.getByRole("button", { name: "first" }));
		expect(opener).toHaveFocus();
	});

	it("only the topmost of two stacked traps handles Tab", async () => {
		render(
			<>
				<Trap>
					<button type="button">under</button>
				</Trap>
				<Trap>
					<button type="button">over one</button>
					<button type="button">over two</button>
				</Trap>
			</>
		);
		await userEvent.tab();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "over one" })).toHaveFocus();
	});

	it("skips controls the browser reports as hidden", () => {
		function WithHidden() {
			const ref = useRef<HTMLDivElement>(null);
			useFocusTrap(ref);
			return (
				<div ref={ref} tabIndex={-1}>
					<button
						type="button"
						ref={node => {
							if (node) node.checkVisibility = () => false;
						}}
					>
						hidden
					</button>
					<button type="button">shown</button>
				</div>
			);
		}
		render(<WithHidden />);
		expect(screen.getByRole("button", { name: "shown" })).toHaveFocus();
	});

	it("treats controls as visible where checkVisibility does not exist", () => {
		function WithoutApi() {
			const ref = useRef<HTMLDivElement>(null);
			useFocusTrap(ref);
			return (
				<div ref={ref} tabIndex={-1}>
					<button
						type="button"
						ref={node => {
							if (node) Object.defineProperty(node, "checkVisibility", { value: undefined });
						}}
					>
						only
					</button>
				</div>
			);
		}
		render(<WithoutApi />);
		expect(screen.getByRole("button", { name: "only" })).toHaveFocus();
	});

	it("keeps Tab inside an element with nothing to tab to", async () => {
		render(
			<>
				<button type="button">page</button>
				<Trap />
			</>
		);
		await userEvent.tab();
		expect(screen.getByTestId("trap")).toHaveFocus();
	});

	it("does nothing while inactive", async () => {
		function Idle() {
			const ref = useRef<HTMLDivElement>(null);
			useFocusTrap(ref, false);
			return (
				<div ref={ref}>
					<button type="button">inside</button>
				</div>
			);
		}
		render(<Idle />);
		expect(screen.getByRole("button", { name: "inside" })).not.toHaveFocus();
	});
});
