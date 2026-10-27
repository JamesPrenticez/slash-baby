import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VolumeModal } from "./VolumeModal";

const AUTO_CLOSE_MS = 3000;

function setup(props: Partial<React.ComponentProps<typeof VolumeModal>> = {}) {
	const onClose = vi.fn();
	const onVolumeChange = vi.fn();
	const view = render(<VolumeModal open volume={0.4} onClose={onClose} onVolumeChange={onVolumeChange} {...props} />);
	return { onClose, onVolumeChange, ...view };
}

describe("VolumeModal", () => {
	it("renders nothing while closed", () => {
		setup({ open: false });
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.queryByRole("slider")).not.toBeInTheDocument();
	});

	it("is a non-modal dialog with one labelled volume slider", () => {
		setup();
		const dialog = screen.getByRole("dialog", { name: "Volume" });
		expect(dialog).not.toHaveAttribute("aria-modal");
		expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("0.4");
	});

	it("reports a new volume as a number from 0 to 1", () => {
		const { onVolumeChange } = setup();
		fireEvent.change(screen.getByRole("slider"), { target: { value: "0.75" } });
		expect(onVolumeChange).toHaveBeenCalledWith(0.75);
	});

	it("takes a position override from its parent", () => {
		setup({ style: { right: 12, bottom: 90 } });
		expect(screen.getByRole("dialog")).toHaveStyle({ right: "12px", bottom: "90px" });
	});

	it("closes on Escape", async () => {
		const { onClose } = setup();
		await userEvent.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("closes on a press outside it but not inside it", async () => {
		const { onClose } = setup();
		await userEvent.click(screen.getByRole("dialog"));
		expect(onClose).not.toHaveBeenCalled();
		await userEvent.click(document.body);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("stops listening for Escape once closed", async () => {
		const { onClose, rerender } = setup();
		rerender(<VolumeModal open={false} volume={0.4} onClose={onClose} onVolumeChange={() => {}} />);
		await userEvent.keyboard("{Escape}");
		expect(onClose).not.toHaveBeenCalled();
	});

	describe("auto close", () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

		it("closes itself after 3 seconds untouched", () => {
			const { onClose } = setup();
			wait(AUTO_CLOSE_MS - 1);
			expect(onClose).not.toHaveBeenCalled();
			wait(1);
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("starts the countdown over every time the volume changes", () => {
			const { onClose, rerender } = setup();
			wait(AUTO_CLOSE_MS - 500);
			rerender(<VolumeModal open volume={0.6} onClose={onClose} onVolumeChange={() => {}} />);
			wait(AUTO_CLOSE_MS - 500);
			expect(onClose).not.toHaveBeenCalled();
			wait(500);
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("does not restart when the parent only passes a new onClose", () => {
			const { rerender } = setup();
			const next = vi.fn();
			wait(AUTO_CLOSE_MS - 500);
			rerender(<VolumeModal open volume={0.4} onClose={next} onVolumeChange={() => {}} />);
			wait(500);
			expect(next).toHaveBeenCalledOnce();
		});

		it("waits while the pointer is over it and resumes when it leaves", () => {
			const { onClose } = setup();
			const dialog = screen.getByRole("dialog");
			fireEvent.mouseEnter(dialog);
			wait(AUTO_CLOSE_MS * 3);
			expect(onClose).not.toHaveBeenCalled();
			fireEvent.mouseLeave(dialog);
			wait(AUTO_CLOSE_MS);
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("waits while a finger is on it and resumes when it lifts", () => {
			const { onClose } = setup();
			const dialog = screen.getByRole("dialog");
			fireEvent.touchStart(dialog);
			wait(AUTO_CLOSE_MS * 3);
			expect(onClose).not.toHaveBeenCalled();
			fireEvent.touchEnd(dialog);
			wait(AUTO_CLOSE_MS);
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("waits while the slider has keyboard focus and resumes when focus leaves", () => {
			const { onClose } = setup();
			const slider = screen.getByRole("slider");
			act(() => slider.focus());
			wait(AUTO_CLOSE_MS * 3);
			expect(onClose).not.toHaveBeenCalled();
			act(() => slider.blur());
			wait(AUTO_CLOSE_MS);
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("does not start a countdown while closed, and cancels it on close", () => {
			const { onClose, rerender } = setup({ open: false });
			wait(AUTO_CLOSE_MS * 2);
			expect(onClose).not.toHaveBeenCalled();

			rerender(<VolumeModal open volume={0.4} onClose={onClose} onVolumeChange={() => {}} />);
			rerender(<VolumeModal open={false} volume={0.4} onClose={onClose} onVolumeChange={() => {}} />);
			wait(AUTO_CLOSE_MS * 2);
			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
