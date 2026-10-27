import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MenuModal } from "./MenuModal";

function setup(props: Partial<React.ComponentProps<typeof MenuModal>> = {}) {
	const handlers = {
		onClose: vi.fn(),
		onEffectsVolumeChange: vi.fn(),
		onMusicVolumeChange: vi.fn(),
		onOpenHistory: vi.fn(),
		onOpenGameInfo: vi.fn()
	};
	const view = render(<MenuModal open effectsVolume={0.3} musicVolume={0.6} {...handlers} {...props} />);
	return { ...handlers, ...view };
}

describe("MenuModal", () => {
	it("renders nothing while closed", () => {
		setup({ open: false });
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("is a non-modal dialog with effects and music sliders and the history and game info rows", () => {
		setup();
		const dialog = screen.getByRole("dialog", { name: "Menu" });
		expect(dialog).not.toHaveAttribute("aria-modal");
		expect(screen.getByRole("slider", { name: "Effects volume" })).toHaveValue("0.3");
		expect(screen.getByRole("slider", { name: "Music volume" })).toHaveValue("0.6");
		expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Game info" })).toBeInTheDocument();
	});

	it("moves focus to the first slider when it opens", () => {
		setup();
		expect(screen.getByRole("slider", { name: "Effects volume" })).toHaveFocus();
	});

	it("Escape hands focus back to the menu toggle", async () => {
		const toggle = document.body.appendChild(document.createElement("button"));
		toggle.dataset.menuToggle = "";
		setup();
		await userEvent.keyboard("{Escape}");
		expect(toggle).toHaveFocus();
		toggle.remove();
	});

	it("leaves out the rows Slash Baby has no feature for", () => {
		setup();
		expect(screen.queryByText(/fairness/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("switch")).not.toBeInTheDocument();
	});

	it("reports each slider on its own handler", () => {
		const { onEffectsVolumeChange, onMusicVolumeChange } = setup();
		fireEvent.change(screen.getByRole("slider", { name: "Effects volume" }), { target: { value: "0.9" } });
		expect(onEffectsVolumeChange).toHaveBeenCalledWith(0.9);
		expect(onMusicVolumeChange).not.toHaveBeenCalled();

		fireEvent.change(screen.getByRole("slider", { name: "Music volume" }), { target: { value: "0.1" } });
		expect(onMusicVolumeChange).toHaveBeenCalledWith(0.1);
	});

	it.each([
		["History", "onOpenHistory"],
		["Game info", "onOpenGameInfo"]
	] as const)("%s opens its modal and closes the menu, by mouse", async (name, handler) => {
		const handlers = setup();
		await userEvent.click(screen.getByRole("button", { name }));
		expect(handlers[handler]).toHaveBeenCalledOnce();
		expect(handlers.onClose).toHaveBeenCalledOnce();
	});

	it.each([
		["History", "onOpenHistory"],
		["Game info", "onOpenGameInfo"]
	] as const)("%s opens its modal and closes the menu, by Enter and by Space", async (name, handler) => {
		const handlers = setup();
		const row = screen.getByRole("button", { name });
		row.focus();
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard(" ");
		expect(handlers[handler]).toHaveBeenCalledTimes(2);
		expect(handlers.onClose).toHaveBeenCalledTimes(2);
	});

	it("is reachable by Tab in reading order", async () => {
		setup();
		expect(screen.getByRole("slider", { name: "Effects volume" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("slider", { name: "Music volume" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "History" })).toHaveFocus();
		await userEvent.tab();
		expect(screen.getByRole("button", { name: "Game info" })).toHaveFocus();
	});

	it("takes a position override from its parent", () => {
		setup({ style: { right: 8, bottom: 110 } });
		expect(screen.getByRole("dialog")).toHaveStyle({ right: "8px", bottom: "110px" });
	});

	it("closes on Escape", async () => {
		const { onClose } = setup();
		await userEvent.keyboard("{Escape}");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("closes on a press outside it but not inside it", async () => {
		const { onClose } = setup();
		await userEvent.click(screen.getByText("Effects"));
		expect(onClose).not.toHaveBeenCalled();
		await userEvent.click(document.body);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("ignores a press on the control that toggles it, so the toggle can close it itself", async () => {
		const { onClose } = setup();
		render(
			<button type="button" data-ignore-click-away>
				Menu toggle
			</button>
		);
		await userEvent.click(screen.getByRole("button", { name: "Menu toggle" }));
		expect(onClose).not.toHaveBeenCalled();
	});

	it("stops listening for Escape once closed", async () => {
		const { onClose, rerender } = setup();
		rerender(
			<MenuModal
				open={false}
				effectsVolume={0}
				musicVolume={0}
				onClose={onClose}
				onEffectsVolumeChange={() => {}}
				onMusicVolumeChange={() => {}}
				onOpenHistory={() => {}}
				onOpenGameInfo={() => {}}
			/>
		);
		await userEvent.keyboard("{Escape}");
		expect(onClose).not.toHaveBeenCalled();
	});
});
