import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { HistoryEntry } from "@/types/round";

import { BetHistoryModal, type BetHistoryModalProps } from "./BetHistoryModal";

const at = (hours: number, minutes: number, seconds: number) =>
	new Date(2026, 9, 25, hours, minutes, seconds).toISOString();

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
	roundId: "round-1",
	createdAt: at(13, 5, 9),
	settledAt: at(13, 5, 40),
	wagerMinorUnits: 100,
	payoutMinorUnits: 250,
	currency: "USD",
	category: "small_win",
	...overrides
});

const LOSS = entry({ roundId: "round-loss", wagerMinorUnits: 1000, payoutMinorUnits: 0, category: "loss" });
const WIN = entry({ roundId: "round-win", wagerMinorUnits: 100, payoutMinorUnits: 250, category: "small_win" });

function setup(props: Partial<BetHistoryModalProps> = {}) {
	const onClose = vi.fn();
	const onPage = vi.fn();
	const view = render(
		<BetHistoryModal
			open
			entries={[WIN, LOSS]}
			total={2}
			loading={false}
			exponent={2}
			currency="USD"
			onClose={onClose}
			onPage={onPage}
			{...props}
		/>
	);
	return { onClose, onPage, ...view };
}

describe("BetHistoryModal", () => {
	it("renders nothing, and asks for nothing, while closed", () => {
		const { onPage } = setup({ open: false });
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(onPage).not.toHaveBeenCalled();
	});

	describe("paging", () => {
		it("asks for the first page when it opens, and again each time it reopens", () => {
			const { onPage, rerender } = setup({ open: false });
			const props = { entries: [], total: 0, loading: false, exponent: 2, currency: "USD", onClose: () => {}, onPage };

			rerender(<BetHistoryModal open {...props} />);
			expect(onPage).toHaveBeenCalledTimes(1);
			expect(onPage).toHaveBeenLastCalledWith(0);

			rerender(<BetHistoryModal open={false} {...props} />);
			rerender(<BetHistoryModal open {...props} />);
			expect(onPage).toHaveBeenCalledTimes(2);
			expect(onPage).toHaveBeenLastCalledWith(0);
		});

		it("does not ask again when the parent re-renders with a new onPage", () => {
			const { onPage, rerender } = setup();
			expect(onPage).toHaveBeenCalledTimes(1);
			const next = vi.fn();
			rerender(
				<BetHistoryModal
					open
					entries={[WIN, LOSS]}
					total={2}
					loading={false}
					exponent={2}
					currency="USD"
					onClose={() => {}}
					onPage={next}
				/>
			);
			expect(onPage).toHaveBeenCalledTimes(1);
			expect(next).not.toHaveBeenCalled();
		});

		it("offers LOAD MORE while the server has more, and asks for the next offset", async () => {
			const { onPage } = setup({ total: 25 });
			onPage.mockClear();
			await userEvent.click(screen.getByRole("button", { name: "LOAD MORE" }));
			expect(onPage).toHaveBeenCalledExactlyOnceWith(2);
		});

		it("hides LOAD MORE once every round is shown", () => {
			setup({ total: 2 });
			expect(screen.queryByRole("button", { name: /load more|loading/i })).not.toBeInTheDocument();
		});

		it("disables the button and says LOADING... while a page is on its way", () => {
			setup({ total: 25, loading: true });
			expect(screen.getByRole("button", { name: "LOADING..." })).toBeDisabled();
		});
	});

	describe("rows", () => {
		it("lists each round with its wager, outcome category and result, newest first as given", () => {
			setup();
			const rows = screen.getAllByRole("listitem");
			expect(rows).toHaveLength(2);

			expect(within(rows[0]).getByText("$1.00")).toBeInTheDocument();
			expect(within(rows[0]).getByText("small win")).toBeInTheDocument();
			expect(within(rows[0]).getByText("+$2.50")).toBeInTheDocument();

			expect(within(rows[1]).getByText("$10.00")).toBeInTheDocument();
			expect(within(rows[1]).getByText("loss")).toBeInTheDocument();
			expect(within(rows[1]).getByText("-$10.00")).toBeInTheDocument();
		});

		it("formats money from integer minor units for the given currency and exponent", () => {
			setup({
				exponent: 0,
				currency: "JPY",
				entries: [entry({ wagerMinorUnits: 1500, payoutMinorUnits: 4500000, category: "big_win" })],
				total: 1
			});
			expect(screen.getByText("¥1,500")).toBeInTheDocument();
			expect(screen.getByText("+¥4,500,000")).toBeInTheDocument();
		});

		it("never works out a multiplier or a net figure itself", () => {
			setup();
			expect(screen.queryByText(/\dx\b/)).not.toBeInTheDocument();
			expect(screen.queryByText("+$1.50")).not.toBeInTheDocument();
		});

		it("marks a loss differently from a win", () => {
			setup();
			expect(screen.getByText("loss")).toHaveAttribute("data-loss");
			expect(screen.getByText("small win")).not.toHaveAttribute("data-loss");
		});

		it("reads every category as words", () => {
			setup({
				entries: [
					entry({ roundId: "a", category: "standard_win" }),
					entry({ roundId: "b", category: "major_win" }),
					entry({ roundId: "c", category: "jackpot" })
				],
				total: 3
			});
			expect(screen.getByText("standard win")).toBeInTheDocument();
			expect(screen.getByText("major win")).toBeInTheDocument();
			expect(screen.getByText("jackpot")).toBeInTheDocument();
		});

		it("expands a round on click to show its id and times, and collapses it again", async () => {
			setup();
			const [first] = screen.getAllByRole("button", { name: /small win/i });
			expect(first).toHaveAttribute("aria-expanded", "false");
			expect(screen.queryByText("round-win")).not.toBeInTheDocument();

			await userEvent.click(first);
			expect(first).toHaveAttribute("aria-expanded", "true");
			expect(screen.getByText("round-win")).toBeInTheDocument();
			expect(screen.getByText("25/10/2026, 13:05:09")).toBeInTheDocument();
			expect(screen.getByText("25/10/2026, 13:05:40")).toBeInTheDocument();
			expect(first).toHaveAttribute("aria-controls", screen.getByText("round-win").closest("dl")?.id);

			await userEvent.click(first);
			expect(first).toHaveAttribute("aria-expanded", "false");
			expect(screen.queryByText("round-win")).not.toBeInTheDocument();
		});

		it("expands from the keyboard", async () => {
			setup();
			const [first] = screen.getAllByRole("button", { name: /small win/i });
			first.focus();
			await userEvent.keyboard("{Enter}");
			expect(screen.getByText("round-win")).toBeInTheDocument();
			await userEvent.keyboard(" ");
			expect(screen.queryByText("round-win")).not.toBeInTheDocument();
		});

		it("keeps a row open when more rounds are appended below it", async () => {
			const { rerender, onPage, onClose } = setup({ total: 3 });
			await userEvent.click(screen.getAllByRole("button", { name: /small win/i })[0]);
			rerender(
				<BetHistoryModal
					open
					entries={[WIN, LOSS, entry({ roundId: "round-3", category: "jackpot" })]}
					total={3}
					loading={false}
					exponent={2}
					currency="USD"
					onClose={onClose}
					onPage={onPage}
				/>
			);
			expect(screen.getByText("round-win")).toBeInTheDocument();
			expect(screen.getAllByRole("listitem")).toHaveLength(3);
		});

		it("shows the raw text when a time cannot be read, instead of Invalid Date", async () => {
			setup({ entries: [entry({ createdAt: "not a date" })], total: 1 });
			await userEvent.click(screen.getByRole("button", { name: /small win/i }));
			expect(screen.getByText("not a date")).toBeInTheDocument();
			expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
		});
	});

	describe("empty and loading", () => {
		it("says there are no rounds yet when nothing has loaded and nothing is loading", () => {
			setup({ entries: [], total: 0 });
			expect(screen.getByText("No rounds yet.")).toBeInTheDocument();
			expect(screen.queryByRole("list")).not.toBeInTheDocument();
			expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
		});

		it("says Loading... as a status while the first page is on its way, not 'no rounds'", () => {
			setup({ entries: [], total: 0, loading: true });
			expect(screen.getByRole("status")).toHaveTextContent("Loading...");
			expect(screen.queryByText("No rounds yet.")).not.toBeInTheDocument();
		});
	});

	describe("closing", () => {
		it("closes from the close button, Escape and the backdrop, and not from a click inside", async () => {
			const { onClose } = setup();
			await userEvent.click(screen.getByText("$10.00"));
			expect(onClose).not.toHaveBeenCalled();

			await userEvent.click(screen.getByRole("button", { name: "Close" }));
			await userEvent.keyboard("{Escape}");
			await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
			expect(onClose).toHaveBeenCalledTimes(3);
		});

		it("is a modal dialog named BET HISTORY that traps Tab and returns focus to the opener", async () => {
			function Harness() {
				const [open, setOpen] = useState(false);
				return (
					<>
						<button type="button" onClick={() => setOpen(true)}>
							Open
						</button>
						<BetHistoryModal
							open={open}
							entries={[WIN]}
							total={5}
							loading={false}
							exponent={2}
							currency="USD"
							onClose={() => setOpen(false)}
							onPage={() => {}}
						/>
					</>
				);
			}
			render(<Harness />);
			const opener = screen.getByRole("button", { name: "Open" });
			await userEvent.click(opener);

			expect(screen.getByRole("dialog", { name: "BET HISTORY" })).toHaveAttribute("aria-modal", "true");
			expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
			await userEvent.tab();
			expect(screen.getByRole("button", { name: /small win/i })).toHaveFocus();
			await userEvent.tab();
			expect(screen.getByRole("button", { name: "LOAD MORE" })).toHaveFocus();
			await userEvent.tab();
			expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

			await userEvent.keyboard("{Escape}");
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			expect(opener).toHaveFocus();
		});
	});
});
