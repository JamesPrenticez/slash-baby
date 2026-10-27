import { create } from "zustand";

import type { AssassinAnimation } from "@/constants/assassinAnimations";

/** What the debug menu asks of the game. The app hands these to `GameCanvas`. */
export type DebugControls = {
	/** Forces one animation. `undefined` leaves it to the run state. */
	animation: AssassinAnimation | undefined;
	/** Scales the scroll speed and the run animation together, so the feet stay planted. */
	speedMultiplier: number;
	/** Changes on every remount; used as the canvas's React `key`. */
	canvasKey: number;
};

type DebugState = DebugControls & {
	open: boolean;
	toggleOpen: () => void;
	setAnimation: (animation: AssassinAnimation | undefined) => void;
	setSpeedMultiplier: (speedMultiplier: number) => void;
	remountCanvas: () => void;
};

/** Debug menu state. Loaded with the menu's chunk, so it is not in a production build. */
export const useDebugStore = create<DebugState>(set => ({
	open: false,
	animation: undefined,
	speedMultiplier: 1,
	canvasKey: 0,
	toggleOpen: () => set(state => ({ open: !state.open })),
	setAnimation: animation => set({ animation }),
	setSpeedMultiplier: speedMultiplier => set({ speedMultiplier }),
	remountCanvas: () => set(state => ({ canvasKey: state.canvasKey + 1 }))
}));
