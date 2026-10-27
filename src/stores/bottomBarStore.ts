import { create } from "zustand";

/**
 * Which panels of the bottom bar are open. As NGU's bottom-bar store, minus the difficulty, autoplay, bonus and
 * fairness flags (TEAM override 3).
 */
type BottomBarStore = {
	menuOpen: boolean;
	volumeOpen: boolean;
	gameInfoOpen: boolean;
	betHistoryOpen: boolean;

	setMenuOpen: (open: boolean) => void;
	setVolumeOpen: (open: boolean) => void;
	setGameInfoOpen: (open: boolean) => void;
	setBetHistoryOpen: (open: boolean) => void;

	/** Opening the menu closes the volume panel; they share the space above the bar. */
	toggleMenu: () => void;
	toggleVolume: () => void;
	toggleGameInfo: () => void;
};

export const useBottomBarStore = create<BottomBarStore>(set => ({
	menuOpen: false,
	volumeOpen: false,
	gameInfoOpen: false,
	betHistoryOpen: false,

	setMenuOpen: open => set({ menuOpen: open }),
	setVolumeOpen: open => set({ volumeOpen: open }),
	setGameInfoOpen: open => set({ gameInfoOpen: open }),
	setBetHistoryOpen: open => set({ betHistoryOpen: open }),

	toggleMenu: () => set(state => ({ menuOpen: !state.menuOpen, volumeOpen: false })),
	toggleVolume: () => set(state => ({ volumeOpen: !state.volumeOpen })),
	toggleGameInfo: () => set(state => ({ gameInfoOpen: !state.gameInfoOpen }))
}));
