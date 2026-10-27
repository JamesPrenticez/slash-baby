import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GameInfoModal } from "./GameInfoModal";

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open
			</button>
			<GameInfoModal
				open={open}
				onClose={() => {
					onClose();
					setOpen(false);
				}}
			/>
		</>
	);
}

describe("GameInfoModal", () => {
	it("renders nothing while closed", () => {
		render(<GameInfoModal open={false} onClose={() => {}} />);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("is a modal dialog named GAME INFO with a section per topic", () => {
		render(<GameInfoModal open onClose={() => {}} />);
		const dialog = screen.getByRole("dialog", { name: "GAME INFO" });
		expect(dialog).toHaveAttribute("aria-modal", "true");
		for (const name of ["How to play", "Round controls", "History", "Balance", "Bet"]) {
			expect(within(dialog).getByRole("region", { name })).toBeInTheDocument();
		}
		// The opening section runs straight on from the title, as in NGU, so it has no heading of its own.
		for (const name of ["Round controls", "History", "Balance", "Bet"]) {
			expect(within(dialog).getByRole("heading", { level: 3, name: new RegExp(`^${name}$`, "i") })).toBeInTheDocument();
		}
	});

	it("shows a PLAY preview that cannot be reached or pressed", () => {
		render(<GameInfoModal open onClose={() => {}} />);
		const preview = screen.getByText("PLAY");
		expect(preview.closest("[aria-hidden='true']")).not.toBeNull();
		expect(preview).toHaveAttribute("tabindex", "-1");
		expect(screen.queryByRole("button", { name: "PLAY" })).not.toBeInTheDocument();
	});

	it("leaves out what Slash Baby has no feature for", () => {
		render(<GameInfoModal open onClose={() => {}} />);
		expect(screen.queryByText(/fairness|seed|volatility|difficulty|autoplay|auto play|bonus/i)).not.toBeInTheDocument();
	});

	it("opens the operator link in a new tab without leaking the opener", () => {
		render(<GameInfoModal open onClose={() => {}} />);
		const link = screen.getByRole("link", { name: "Animo.Net" });
		expect(link).toHaveAttribute("href", "https://animo.net/");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
	});

	it("closes from the close button, Escape and the backdrop, and not from a click inside", async () => {
		const onClose = vi.fn();
		render(<GameInfoModal open onClose={onClose} />);

		await userEvent.click(screen.getByText(/place your bet/i));
		expect(onClose).not.toHaveBeenCalled();

		await userEvent.click(screen.getByRole("button", { name: "Close" }));
		await userEvent.keyboard("{Escape}");
		await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
		expect(onClose).toHaveBeenCalledTimes(3);
	});

	it("traps Tab, and returns focus to the opener on close", async () => {
		render(<Harness />);
		const opener = screen.getByRole("button", { name: "Open" });
		await userEvent.click(opener);

		expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("link", { name: "Animo.Net" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
		await userEvent.tab({ shift: true });
		expect(screen.getByRole("link", { name: "Animo.Net" })).toHaveFocus();

		await userEvent.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(opener).toHaveFocus();
	});
});
