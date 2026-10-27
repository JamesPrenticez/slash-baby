import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useBottomBarStore } from "@/stores/bottomBarStore";
import { useSettingsStore } from "@/stores/settingsStore";

import { MenuAudioSection } from "./MenuAudioSection";

beforeEach(() => {
	useBottomBarStore.setState({ menuOpen: false, volumeOpen: false });
	useSettingsStore.setState({ muted: false, volume: 1 });
});

describe("MenuAudioSection", () => {
	it("has a named menu button and a named audio button", () => {
		render(<MenuAudioSection />);
		expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
	});

	it("the menu button toggles the menu and its name follows the state", async () => {
		render(<MenuAudioSection />);
		await userEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(useBottomBarStore.getState().menuOpen).toBe(true);
		await userEvent.click(screen.getByRole("button", { name: "Close Menu" }));
		expect(useBottomBarStore.getState().menuOpen).toBe(false);
		expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
	});

	it("the menu button says it opens a popover and whether it is open", async () => {
		render(<MenuAudioSection />);
		const toggle = screen.getByRole("button", { name: "Menu" });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(toggle);
		expect(screen.getByRole("button", { name: "Close Menu" })).toHaveAttribute("aria-expanded", "true");
	});

	it("opening the menu closes the volume panel", async () => {
		useBottomBarStore.setState({ volumeOpen: true });
		render(<MenuAudioSection />);
		await userEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(useBottomBarStore.getState()).toMatchObject({ menuOpen: true, volumeOpen: false });
	});

	it("the audio button mutes, and opens the volume panel instead of the menu", async () => {
		useBottomBarStore.setState({ menuOpen: true });
		render(<MenuAudioSection />);
		await userEvent.click(screen.getByRole("button", { name: "Mute" }));
		expect(useSettingsStore.getState().muted).toBe(true);
		expect(useBottomBarStore.getState()).toMatchObject({ volumeOpen: true, menuOpen: false });
		expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
	});

	it("the audio button unmutes, and leaves an open volume panel open", async () => {
		useSettingsStore.setState({ muted: true });
		useBottomBarStore.setState({ volumeOpen: true });
		render(<MenuAudioSection />);
		await userEvent.click(screen.getByRole("button", { name: "Unmute" }));
		expect(useSettingsStore.getState().muted).toBe(false);
		expect(useBottomBarStore.getState().volumeOpen).toBe(true);
	});

	it("marks both buttons so a click-outside handler counts them as inside", () => {
		render(<MenuAudioSection />);
		expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("data-ignore-click-away");
		expect(screen.getByRole("button", { name: "Mute" })).toHaveAttribute("data-ignore-click-away");
	});
});
