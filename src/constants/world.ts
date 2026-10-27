import { groundSpeed } from "@/utils/parallax";

/** Placeholder: settled when the first real art arrives. */
export const WORLD_HEIGHT = 400;

/** Layer art is authored at 2× the logical height for high-DPI screens. */
export const TEXTURE_SCALE = 0.5;

/** Where the assassin's feet meet the top of the ground band. */
export const GROUND_Y = 344;

export const ASSASSIN_HEIGHT = 150;

/** Fraction of the screen width the assassin holds, left to right. */
export const ASSASSIN_X_FRACTION = 0.3;

/** Length of the stand-in character's `run` animation. */
export const RUN_CYCLE_S = 0.67;

/** Calibration: world px per run cycle. Spine Boy's planted-foot speed measures ~250 px/s at this scale; retune for the real art. */
export const STRIDE_PX = 170;

export const RUN_TIME_SCALE = 1;

export const RUN_SPEED = groundSpeed(STRIDE_PX, RUN_CYCLE_S, RUN_TIME_SCALE);

/** Time constant for easing between standing and running. */
export const SPEED_EASE_MS = 180;

/** Far to near. Ground is factor 1, so it moves at exactly the run speed. */
export const LAYERS = [
	{ alias: "layerSky", factor: 0 },
	{ alias: "layerFar", factor: 1 / 16 },
	{ alias: "layerMidFar", factor: 1 / 8 },
	{ alias: "layerMid", factor: 1 / 4 },
	{ alias: "layerNear", factor: 1 / 2 },
	{ alias: "layerGround", factor: 1 }
] as const;
