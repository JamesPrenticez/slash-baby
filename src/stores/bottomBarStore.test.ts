import { useBottomBarStore } from "./bottomBarStore";

const closed = { menuOpen: false, volumeOpen: false, gameInfoOpen: false, betHistoryOpen: false };

beforeEach(() => {
	useBottomBarStore.setState(closed);
});

describe("bottomBarStore", () => {
	it("starts with everything closed", () => {
		expect(useBottomBarStore.getState()).toMatchObject(closed);
	});

	it.each([
		["menuOpen", "setMenuOpen"],
		["volumeOpen", "setVolumeOpen"],
		["gameInfoOpen", "setGameInfoOpen"],
		["betHistoryOpen", "setBetHistoryOpen"]
	] as const)("%s is set by %s", (flag, setter) => {
		useBottomBarStore.getState()[setter](true);
		expect(useBottomBarStore.getState()[flag]).toBe(true);
		useBottomBarStore.getState()[setter](false);
		expect(useBottomBarStore.getState()[flag]).toBe(false);
	});

	it("toggleMenu flips the menu and closes the volume panel", () => {
		useBottomBarStore.setState({ volumeOpen: true });
		useBottomBarStore.getState().toggleMenu();
		expect(useBottomBarStore.getState()).toMatchObject({ menuOpen: true, volumeOpen: false });
		useBottomBarStore.getState().toggleMenu();
		expect(useBottomBarStore.getState().menuOpen).toBe(false);
	});

	it("toggleVolume and toggleGameInfo flip only their own flag", () => {
		useBottomBarStore.setState({ menuOpen: true });
		useBottomBarStore.getState().toggleVolume();
		useBottomBarStore.getState().toggleGameInfo();
		expect(useBottomBarStore.getState()).toMatchObject({ menuOpen: true, volumeOpen: true, gameInfoOpen: true });
		useBottomBarStore.getState().toggleVolume();
		useBottomBarStore.getState().toggleGameInfo();
		expect(useBottomBarStore.getState()).toMatchObject({ volumeOpen: false, gameInfoOpen: false });
	});
});
